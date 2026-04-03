import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, InternalServerError, NotFoundError } from '../utils/appErrors';
import { presenceService } from '../services/presenceService';

export const listCoworkRooms = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*, cowork_participants(count)')
    .eq('is_cowork', true)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
      return res.json([]);
    }
    logger.error('List cowork rooms error:', error.message);
    throw new InternalServerError('Failed to fetch cowork rooms.');
  }

  const rooms = (data ?? []).map((r: any) => ({
    ...r,
    active_count: r.cowork_participants?.[0]?.count || 0,
  }));

  res.json(rooms);
});

export const createCoworkRoom = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { name, description, domain, session_duration_minutes, break_duration_minutes } = req.body;

  if (!userId) throw new BadRequestError('Authentication required.');
  if (!name) throw new BadRequestError('Room name is required.');

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .insert({
      name,
      description: description || 'Focus together',
      domain: domain || null,
      type: 'cowork',
      creator_id: userId,
      is_cowork: true,
      session_duration_minutes: session_duration_minutes || 25,
      break_duration_minutes: break_duration_minutes || 5,
    })
    .select()
    .single();

  if (error) {
    logger.error('Create cowork room error:', error.message);
    throw new InternalServerError('Failed to create cowork room.');
  }

  await supabase
    .from('chat_room_members')
    .upsert({ room_id: room.id, user_id: userId }, { onConflict: 'room_id,user_id' });

  await supabase
    .from('cowork_participants')
    .upsert({ room_id: room.id, user_id: userId, is_active: true }, { onConflict: 'room_id,user_id' });

  res.status(201).json(room);
});

export const joinCoworkRoom = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const roomId = req.params.roomId as string;
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('id', roomId)
    .eq('is_cowork', true)
    .single();

  if (!room) throw new NotFoundError('Cowork room not found.');

  await supabase
    .from('chat_room_members')
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' });

  await supabase
    .from('cowork_participants')
    .upsert(
      { room_id: roomId, user_id: userId, is_active: true, joined_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id' }
    );

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url')
    .eq('id', userId)
    .single();

  if (profile) {
    await presenceService.joinRoom(roomId, userId, {
      name: profile.name,
      avatar_url: profile.avatar_url,
    });
  }

  res.json({ joined: true, roomId, settings: { session: room.session_duration_minutes, break: room.break_duration_minutes } });
});

export const leaveCoworkRoom = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const roomId = req.params.roomId as string;
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

  await presenceService.leaveRoom(roomId, userId);

  await supabase
    .from('cowork_participants')
    .update({ is_active: false })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  res.json({ left: true, roomId });
});

export const startCoworkSession = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { roomId, goal_domain, goal_description } = req.body;

  if (!userId) throw new BadRequestError('Authentication required.');
  if (!roomId) throw new BadRequestError('Room ID is required.');

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('session_duration_minutes')
    .eq('id', roomId)
    .single();

  const { data: session, error } = await supabase
    .from('cowork_sessions')
    .insert({
      room_id: roomId,
      user_id: userId,
      goal_domain: goal_domain || null,
      goal_description: goal_description || null,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error('Start cowork session error:', error.message);
    throw new InternalServerError('Failed to start session.');
  }

  await supabase
    .from('chat_rooms')
    .update({ current_session_start: new Date().toISOString() })
    .eq('id', roomId);

  res.json({
    session_id: session.id,
    duration_minutes: room?.session_duration_minutes || 25,
    started_at: session.started_at,
  });
});

export const endCoworkSession = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { sessionId } = req.params;
  const userId = req.user?.id;
  const { completed } = req.body;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: session } = await supabase
    .from('cowork_sessions')
    .select('*, chat_rooms(session_duration_minutes)')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (!session) throw new NotFoundError('Session not found.');

  const endedAt = new Date();
  const startedAt = new Date(session.started_at);
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  const { error } = await supabase
    .from('cowork_sessions')
    .update({
      ended_at: endedAt.toISOString(),
      duration_minutes: durationMinutes,
      completed: completed !== false,
    })
    .eq('id', sessionId);

  if (error) {
    logger.error('End cowork session error:', error.message);
    throw new InternalServerError('Failed to end session.');
  }

  if (completed) {
    await supabase.rpc('increment_cowork_stats', {
      p_user_id: userId,
      p_minutes: durationMinutes,
    });
  }

  const xpEarned = completed ? durationMinutes * 2 : Math.floor(durationMinutes);
  const ppEarned = completed ? Math.floor(durationMinutes / 10) : 0;

  if (xpEarned > 0) {
    await supabase.rpc('add_xp_to_user', {
      p_user_id: userId,
      p_xp_amount: xpEarned,
      p_pp_amount: ppEarned,
      p_source: 'cowork_session',
    });
  }

  res.json({
    success: true,
    duration_minutes: durationMinutes,
    completed: completed !== false,
    xp_earned: xpEarned,
    pp_earned: ppEarned,
  });
});

export const getCoworkStats = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data, error } = await supabase.rpc('get_user_cowork_stats', {
    p_user_id: userId,
  });

  if (error) {
    logger.error('Get cowork stats error:', error.message);
    return res.json({ total_sessions: 0, total_minutes: 0, completed_sessions: 0, current_streak_days: 0 });
  }

  res.json(data?.[0] || { total_sessions: 0, total_minutes: 0, completed_sessions: 0, current_streak_days: 0 });
});

export const getActiveCoworkers = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const roomId = req.params.roomId as string;

  const onlineUsers = presenceService.getOnlineUsers(roomId);
  
  if (onlineUsers.length > 0) {
    return res.json(onlineUsers);
  }

  const { data, error } = await supabase.rpc('get_active_coworkers', {
    p_room_id: roomId,
  });

  if (error) {
    logger.error('Get active coworkers error:', error.message);
    return res.json([]);
  }

  res.json(data || []);
});

export const getMyCoworkRoom = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: participant } = await supabase
    .from('cowork_participants')
    .select('room_id, is_active, joined_at, total_focus_minutes, sessions_completed')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (!participant) {
    return res.json({ in_room: false });
  }

  const { data: room } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('id', participant.room_id)
    .single();

  res.json({
    in_room: true,
    room,
    stats: {
      focus_minutes: participant.total_focus_minutes,
      sessions_completed: participant.sessions_completed,
    },
  });
});
