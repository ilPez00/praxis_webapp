import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';
import { pushNotification } from './notificationController';

// GET /friends — accepted friends list
export const getFriends = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id, created_at,
      requester:profiles!requester_id(id, name, avatar_url, current_streak, praxis_points),
      recipient:profiles!recipient_id(id, name, avatar_url, current_streak, praxis_points)
    `)
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) return res.status(500).json({ message: error.message });

  const friends = (data || []).map((f: any) => {
    const friend = f.requester_id === userId ? f.recipient : f.requester;
    return { friendshipId: f.id, ...friend };
  });
  res.json(friends);
});

// GET /friends/requests/incoming — incoming pending requests
export const getIncomingRequests = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('friendships')
    .select(`id, created_at, requester:profiles!requester_id(id, name, avatar_url, current_streak)`)
    .eq('recipient_id', userId)
    .eq('status', 'pending');

  if (error) return res.status(500).json({ message: error.message });
  res.json(data || []);
});

// GET /friends/status/:targetUserId — friendship status with a specific user
export const getFriendStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId } = req.params;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, recipient_id')
    .or(`and(requester_id.eq.${userId},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${userId})`)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });
  if (!data) return res.json({ status: 'none' });

  res.json({
    status: data.status,
    requestId: data.id,
    iAmRequester: data.requester_id === userId,
  });
});

// POST /friends/request/:targetUserId — send friend request
export const sendFriendRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId } = req.params;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  if (userId === targetUserId) return res.status(400).json({ message: 'Cannot add yourself.' });

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: userId, recipient_id: targetUserId, status: 'pending' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Friend request already exists.' });
    return res.status(500).json({ message: error.message });
  }

  // Notify recipient (fire-and-forget)
  supabase.from('profiles').select('name').eq('id', userId).single().then(({ data: sender }) => {
    pushNotification({
      userId: targetUserId as string,
      type: 'friend_request',
      title: `${sender?.name ?? 'Someone'} sent you a friend request`,
      link: '/friends',
      actorId: userId as string,
    });
  });

  res.status(201).json(data);
});

// POST /friends/accept/:requestId — accept
export const acceptFriendRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { requestId } = req.params;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) return res.status(404).json({ message: 'Request not found or already handled.' });

  // Notify requester that their request was accepted (fire-and-forget)
  supabase.from('profiles').select('name').eq('id', userId).single().then(({ data: accepter }) => {
    pushNotification({
      userId: data.requester_id as string,
      type: 'friend_accepted',
      title: `${accepter?.name ?? 'Someone'} accepted your friend request`,
      link: `/profile/${userId}`,
      actorId: userId as string,
    });
  });

  res.json(data);
});

// DELETE /friends/requests/:requestId — reject/cancel
export const rejectOrCancelRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { requestId } = req.params;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', requestId)
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);

  if (error) return res.status(500).json({ message: error.message });
  res.json({ message: 'Removed.' });
});

// GET /friends/of/:userId — public friend list for any user
export const getFriendsByUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ message: 'userId required.' });

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      requester_id,
      recipient_id,
      requester:profiles!requester_id(id, name, avatar_url, current_streak, praxis_points),
      recipient:profiles!recipient_id(id, name, avatar_url, current_streak, praxis_points)
    `)
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) return res.status(500).json({ message: error.message });

  const friends = (data || []).map((f: any) => {
    const friend = f.requester_id === userId ? f.recipient : f.requester;
    return { friendshipId: f.id, ...friend };
  });
  res.json(friends);
});

// DELETE /friends/:friendId — unfriend
export const unfriend = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { friendId } = req.params;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(requester_id.eq.${userId},recipient_id.eq.${friendId}),and(requester_id.eq.${friendId},recipient_id.eq.${userId})`);

  if (error) return res.status(500).json({ message: error.message });
  res.json({ message: 'Unfriended.' });
});
