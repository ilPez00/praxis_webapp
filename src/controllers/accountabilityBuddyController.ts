import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync } from '../utils/appErrors';
import logger from '../utils/logger';

const BUDDY_XP_BONUS = 25; // Bonus XP when both partners check in
const MUTUAL_STREAK_BONUS = 50; // Bonus XP per week of mutual check-ins

export const getMyBuddyPairs = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  const { data: buddies, error } = await supabase
    .from('accountability_buddies')
    .select(`
      *,
      requester:requester_id (id, name, avatar_url, current_streak),
      receiver:receiver_id (id, name, avatar_url, current_streak)
    `)
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // Get today's checkin status for each pair
  const today = new Date().toISOString().slice(0, 10);
  const pairsWithStatus = await Promise.all(
    (buddies || []).map(async (pair: any) => {
      const { data: checkins } = await supabase
        .from('buddy_checkins')
        .select('user_id')
        .eq('buddy_pair_id', pair.id)
        .eq('checkin_date', today);
      
      const checkedInUsers = new Set((checkins || []).map((c: any) => c.user_id));
      
      const partner = pair.requester_id === userId ? pair.receiver : pair.requester;
      const myCheckin = checkedInUsers.has(userId);
      const partnerCheckin = partner ? checkedInUsers.has(partner.id) : false;
      
      return {
        ...pair,
        partner,
        myCheckin,
        partnerCheckedIn: partnerCheckin,
        bothCheckedIn: myCheckin && partnerCheckin,
      };
    })
  );

  res.json({ buddies: pairsWithStatus });
});

export const getPendingRequests = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  const { data: requests, error } = await supabase
    .from('accountability_buddies')
    .select(`
      *,
      requester:requester_id (id, name, avatar_url, current_streak)
    `)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json({ requests: requests || [] });
});

export const sendBuddyRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { receiverId } = req.body;
  
  if (!receiverId) {
    return res.status(400).json({ message: 'receiverId is required' });
  }
  
  if (receiverId === userId) {
    return res.status(400).json({ message: 'Cannot pair with yourself' });
  }
  
  // Check if receiver exists
  const { data: receiver, error: receiverError } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', receiverId)
    .single();
  
  if (receiverError || !receiver) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  // Check for existing relationship
  const { data: existing } = await supabase
    .from('accountability_buddies')
    .select('id, status')
    .or(`and(requester_id.eq.${userId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${userId})`)
    .single();
  
  if (existing) {
    if (existing.status === 'pending') {
      return res.status(400).json({ message: 'Request already pending' });
    }
    if (existing.status === 'accepted') {
      return res.status(400).json({ message: 'Already paired with this user' });
    }
  }
  
  const { data: request, error } = await supabase
    .from('accountability_buddies')
    .insert({ requester_id: userId, receiver_id: receiverId, status: 'pending' })
    .select(`
      *,
      requester:requester_id (id, name, avatar_url)
    `)
    .single();
  
  if (error) throw error;
  
  logger.info(`[AccountabilityBuddy] User ${userId} sent request to ${receiverId}`);
  res.json({ request });
});

export const respondToRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { requestId } = req.params;
  const { accept } = req.body;
  
  const { data: request, error: getError } = await supabase
    .from('accountability_buddies')
    .select('*')
    .eq('id', requestId)
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .single();
  
  if (getError || !request) {
    return res.status(404).json({ message: 'Request not found' });
  }
  
  const newStatus = accept ? 'accepted' : 'declined';
  
  const { data: updated, error } = await supabase
    .from('accountability_buddies')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select(`
      *,
      requester:requester_id (id, name, avatar_url),
      receiver:receiver_id (id, name, avatar_url)
    `)
    .single();
  
  if (error) throw error;
  
  logger.info(`[AccountabilityBuddy] User ${userId} ${accept ? 'accepted' : 'declined'} request from ${request.requester_id}`);
  res.json({ buddy: updated });
});

export const recordBuddyCheckin = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { buddyPairId } = req.params;
  
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  
  // Get the buddy pair
  const { data: pair, error: pairError } = await supabase
    .from('accountability_buddies')
    .select('*')
    .eq('id', buddyPairId)
    .eq('status', 'accepted')
    .single();
  
  if (pairError || !pair) {
    return res.status(404).json({ message: 'Buddy pair not found' });
  }
  
  // Verify user is part of this pair
  if (pair.requester_id !== userId && pair.receiver_id !== userId) {
    return res.status(403).json({ message: 'Not part of this buddy pair' });
  }
  
  const partnerId = pair.requester_id === userId ? pair.receiver_id : pair.requester_id;
  
  // Check if partner has already checked in today
  const { data: partnerCheckin } = await supabase
    .from('buddy_checkins')
    .select('user_id')
    .eq('buddy_pair_id', buddyPairId)
    .eq('user_id', partnerId)
    .eq('checkin_date', today)
    .single();
  
  // Record this user's checkin
  const { error: insertError } = await supabase
    .from('buddy_checkins')
    .upsert({
      buddy_pair_id: buddyPairId,
      user_id: userId,
      checkin_date: today,
      checked_in_at: now,
    }, {
      onConflict: 'buddy_pair_id,user_id,checkin_date',
    });
  
  if (insertError) throw insertError;
  
  // Calculate mutual check-in status
  const { data: todayCheckins } = await supabase
    .from('buddy_checkins')
    .select('user_id')
    .eq('buddy_pair_id', buddyPairId)
    .eq('checkin_date', today);
  
  const checkedInUsers = new Set((todayCheckins || []).map((c: any) => c.user_id));
  const bothCheckedIn = checkedInUsers.has(userId) && checkedInUsers.has(partnerId);
  
  let xpEarned = 0;
  let mutualStreakBonus = false;
  
  if (bothCheckedIn) {
    xpEarned = BUDDY_XP_BONUS;
    
    // Check for mutual streak (consecutive days both checked in)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    
    const { data: yesterdayCheckins } = await supabase
      .from('buddy_checkins')
      .select('user_id')
      .eq('buddy_pair_id', buddyPairId)
      .eq('checkin_date', yesterdayStr);
    
    const yesterdayUsers = new Set((yesterdayCheckins || []).map((c: any) => c.user_id));
    const hadYesterdayStreak = yesterdayUsers.has(userId) && yesterdayUsers.has(partnerId);
    
    // Update mutual streak
    const newMutualStreak = hadYesterdayStreak ? pair.mutual_checkin_streak + 1 : 1;
    const newLongestStreak = Math.max(pair.longest_mutual_streak, newMutualStreak);
    
    await supabase
      .from('accountability_buddies')
      .update({
        mutual_checkin_streak: newMutualStreak,
        longest_mutual_streak: newLongestStreak,
        total_buddy_days: pair.total_buddy_days + 1,
        updated_at: now,
      })
      .eq('id', buddyPairId);
    
    // Weekly streak bonus
    if (newMutualStreak % 7 === 0) {
      xpEarned += MUTUAL_STREAK_BONUS;
      mutualStreakBonus = true;
    }
    
    logger.info(`[AccountabilityBuddy] Mutual check-in! Users ${userId} & ${partnerId}, streak: ${newMutualStreak}`);
  }
  
  res.json({
    success: true,
    bothCheckedIn,
    xpEarned,
    mutualStreakBonus,
    mutualStreak: pair.mutual_checkin_streak + (bothCheckedIn ? 1 : 0),
  });
});

export const getBuddyStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  // Get all accepted buddy pairs
  const { data: pairs } = await supabase
    .from('accountability_buddies')
    .select('*')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  
  // Get this week's check-ins for each pair
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  
  const pairIds = (pairs || []).map((p: any) => p.id);
  
  if (pairIds.length === 0) {
    return res.json({
      stats: {
        activePairs: 0,
        thisWeekMutual: 0,
        totalMutualDays: 0,
        longestStreak: 0,
        currentStreak: 0,
      }
    });
  }
  
  const { data: weekCheckins } = await supabase
    .from('buddy_checkins')
    .select('buddy_pair_id, user_id, checkin_date')
    .in('buddy_pair_id', pairIds)
    .gte('checkin_date', weekStartStr);
  
  // Count mutual days this week
  const daysThisWeek = new Set<string>();
  const userCheckins = new Set<string>();
  const partnerCheckins = new Set<string>();
  
  for (const checkin of weekCheckins || []) {
    const key = `${checkin.buddy_pair_id}:${checkin.checkin_date}`;
    daysThisWeek.add(key);
    if (checkin.user_id === userId) {
      userCheckins.add(checkin.checkin_date);
    } else {
      partnerCheckins.add(checkin.checkin_date);
    }
  }
  
  let thisWeekMutual = 0;
  for (const date of userCheckins) {
    if (partnerCheckins.has(date)) thisWeekMutual++;
  }
  
  const totalMutualDays = (pairs || []).reduce((sum: number, p: any) => sum + (p.total_buddy_days || 0), 0);
  const longestStreak = Math.max(0, ...(pairs || []).map((p: any) => p.longest_mutual_streak || 0));
  const currentStreak = Math.max(0, ...(pairs || []).map((p: any) => p.mutual_checkin_streak || 0));
  
  res.json({
    stats: {
      activePairs: pairs?.length || 0,
      thisWeekMutual,
      totalMutualDays,
      longestStreak,
      currentStreak,
    }
  });
});

export const pauseBuddyPair = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { pairId } = req.params;
  
  const { data: pair, error } = await supabase
    .from('accountability_buddies')
    .select('*')
    .eq('id', pairId)
    .eq('status', 'accepted')
    .single();
  
  if (error || !pair) {
    return res.status(404).json({ message: 'Buddy pair not found' });
  }
  
  if (pair.requester_id !== userId && pair.receiver_id !== userId) {
    return res.status(403).json({ message: 'Not part of this buddy pair' });
  }
  
  const { data: updated, error: updateError } = await supabase
    .from('accountability_buddies')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', pairId)
    .single();
  
  if (updateError) throw updateError;
  
  res.json({ success: true, pair: updated });
});
