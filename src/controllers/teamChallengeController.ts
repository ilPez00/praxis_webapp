import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, InternalServerError, NotFoundError } from '../utils/appErrors';

export const listTeamChallenges = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_participants(count), chat_rooms(name)')
    .eq('is_team', true)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
      return res.json([]);
    }
    logger.error('List team challenges error:', error.message);
    throw new InternalServerError('Failed to fetch team challenges.');
  }

  const challenges = (data ?? []).map((c: any) => ({
    ...c,
    team_name: c.chat_rooms?.name,
    participants_count: c.challenge_participants?.[0]?.count || 0,
  }));

  res.json(challenges);
});

export const createTeamChallenge = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { title, description, domain, stake_pp, deadline_days, max_members, team_name } = req.body;

  if (!userId) throw new BadRequestError('Authentication required.');
  if (!title) throw new BadRequestError('Title is required.');

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + (deadline_days || 7));

  const { data: teamRoom, error: teamError } = await supabase
    .from('chat_rooms')
    .insert({
      name: team_name || `${title} Team`,
      description: description || `Team for challenge: ${title}`,
      domain: domain || null,
      type: 'challenge_team',
      creator_id: userId,
    })
    .select()
    .single();

  if (teamError) {
    logger.error('Create team room error:', teamError.message);
    throw new InternalServerError('Failed to create team room.');
  }

  const { data: challenge, error } = await supabase
    .from('challenges')
    .insert({
      title,
      description,
      domain,
      stake_pp: stake_pp || 50,
      deadline: deadline.toISOString(),
      deadline_days: deadline_days || 7,
      creator_id: userId,
      is_team: true,
      max_members: max_members || 10,
      team_id: teamRoom.id,
    })
    .select()
    .single();

  if (error) {
    logger.error('Create team challenge error:', error.message);
    throw new InternalServerError('Failed to create team challenge.');
  }

  await supabase
    .from('chat_room_members')
    .upsert({ room_id: teamRoom.id, user_id: userId }, { onConflict: 'room_id,user_id' });

  const { data: teamParticipant } = await supabase
    .from('team_challenge_participants')
    .insert({
      challenge_id: challenge.id,
      team_id: teamRoom.id,
    })
    .select()
    .single();

  if (teamParticipant) {
    await supabase
      .from('team_challenge_members')
      .insert({
        team_participant_id: teamParticipant.id,
        user_id: userId,
      });
  }

  res.status(201).json({
    ...challenge,
    team_room: teamRoom,
  });
});

export const joinTeamChallenge = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { challengeId } = req.params;
  const userId = req.user?.id;
  const { teamId } = req.body;

  if (!userId) throw new BadRequestError('Authentication required.');
  if (!teamId) throw new BadRequestError('Team ID is required.');

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, max_members, is_team')
    .eq('id', challengeId)
    .eq('is_team', true)
    .single();

  if (!challenge) throw new NotFoundError('Team challenge not found.');

  const { data: teamParticipant } = await supabase
    .from('team_challenge_participants')
    .select('id, members_count')
    .eq('challenge_id', challengeId)
    .eq('team_id', teamId)
    .single();

  if (!teamParticipant) throw new NotFoundError('Team not found in this challenge.');
  if (teamParticipant.members_count >= challenge.max_members) {
    throw new BadRequestError('Team is full.');
  }

  const { data: existing } = await supabase
    .from('team_challenge_members')
    .select('id')
    .eq('team_participant_id', teamParticipant.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return res.json({ message: 'Already a member of this team.', joined: false });
  }

  const { error } = await supabase
    .from('team_challenge_members')
    .insert({
      team_participant_id: teamParticipant.id,
      user_id: userId,
    });

  if (error) {
    logger.error('Join team challenge error:', error.message);
    throw new InternalServerError('Failed to join team challenge.');
  }

  await supabase
    .from('chat_room_members')
    .upsert({ room_id: teamId, user_id: userId }, { onConflict: 'room_id,user_id' });

  const { data: prof } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
  if (prof) {
    await supabase.from('profiles').update({ praxis_points: (prof.praxis_points ?? 0) + 20 }).eq('id', userId);
  }

  res.json({ message: 'Joined team challenge.', pp_awarded: 20, joined: true });
});

export const leaveTeamChallenge = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { challengeId } = req.params;
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: membership } = await supabase
    .from('team_challenge_members')
    .select('team_participant_id, team_challenge_participants(team_id)')
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return res.json({ message: 'Not a member of any team in this challenge.' });
  }

  await supabase
    .from('team_challenge_members')
    .delete()
    .eq('team_participant_id', membership.team_participant_id)
    .eq('user_id', userId);

  res.json({ message: 'Left team challenge.' });
});

export const getTeamLeaderboard = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { challengeId } = req.params;

  const { data, error } = await supabase.rpc('get_team_leaderboard', {
    p_challenge_id: challengeId,
  });

  if (error) {
    logger.error('Get team leaderboard error:', error.message);
    return res.json([]);
  }

  res.json(data || []);
});

export const contributeToTeam = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { xp, pp } = req.body;
  const { challengeId } = req.params;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: membership } = await supabase
    .from('team_challenge_members')
    .select('id, contributed_xp, contributed_pp')
    .eq('user_id', userId)
    .single();

  if (!membership) {
    throw new BadRequestError('You are not part of a team in this challenge.');
  }

  const { error } = await supabase
    .from('team_challenge_members')
    .update({
      contributed_xp: (membership.contributed_xp || 0) + (xp || 0),
      contributed_pp: (membership.contributed_pp || 0) + (pp || 0),
    })
    .eq('id', membership.id);

  if (error) {
    logger.error('Contribute to team error:', error.message);
    throw new InternalServerError('Failed to contribute to team.');
  }

  res.json({ success: true, contributed_xp: xp, contributed_pp: pp });
});

export const getMyTeamChallenge = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: membership } = await supabase
    .from('team_challenge_members')
    .select('team_participant_id, contributed_xp, contributed_pp, joined_at')
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return res.json({ in_team: false });
  }

  const { data: teamParticipant } = await supabase
    .from('team_challenge_participants')
    .select('id, challenge_id, team_id, total_xp, total_pp, members_count')
    .eq('id', membership.team_participant_id)
    .single();

  if (!teamParticipant) {
    return res.json({ in_team: false });
  }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', teamParticipant.challenge_id)
    .single();

  const { data: teamRoom } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('id', teamParticipant.team_id)
    .single();

  const { data: members } = await supabase
    .from('team_challenge_members')
    .select('user_id, contributed_xp, contributed_pp, joined_at, profiles(id, name, avatar_url)')
    .eq('team_participant_id', teamParticipant.id)
    .order('contributed_xp', { ascending: false });

  res.json({
    in_team: true,
    challenge,
    team: teamRoom,
    my_contribution: {
      xp: membership.contributed_xp,
      pp: membership.contributed_pp,
    },
    team_total: {
      xp: teamParticipant.total_xp,
      pp: teamParticipant.total_pp,
      members: teamParticipant.members_count,
    },
    members: members || [],
  });
});
