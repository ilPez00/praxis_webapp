import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('does not exist') || msg?.includes('42P01');

// ---------------------------------------------------------------------------
// GET /mutes — return current user's muted users + rooms
// ---------------------------------------------------------------------------

export const getMutes = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('mutes')
    .select('muted_user_id, muted_room_id')
    .eq('user_id', userId);

  if (error && SCHEMA_MISSING(error.message)) return res.json({ mutedUsers: [], mutedRooms: [] });

  const mutedUsers = (data ?? []).filter(r => r.muted_user_id).map(r => r.muted_user_id as string);
  const mutedRooms = (data ?? []).filter(r => r.muted_room_id).map(r => r.muted_room_id as string);
  res.json({ mutedUsers, mutedRooms });
});

// ---------------------------------------------------------------------------
// POST /mutes/user/:targetId
// ---------------------------------------------------------------------------

export const muteUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { targetId } = req.params;

  await supabase
    .from('mutes')
    .upsert({ user_id: userId, muted_user_id: targetId }, { onConflict: 'user_id,muted_user_id' });

  res.json({ ok: true, muted: true });
});

// ---------------------------------------------------------------------------
// DELETE /mutes/user/:targetId
// ---------------------------------------------------------------------------

export const unmuteUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { targetId } = req.params;

  await supabase
    .from('mutes')
    .delete()
    .eq('user_id', userId)
    .eq('muted_user_id', targetId);

  res.json({ ok: true, muted: false });
});

// ---------------------------------------------------------------------------
// POST /mutes/room/:roomId
// ---------------------------------------------------------------------------

export const muteRoom = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { roomId } = req.params;

  await supabase
    .from('mutes')
    .upsert({ user_id: userId, muted_room_id: roomId }, { onConflict: 'user_id,muted_room_id' });

  res.json({ ok: true, muted: true });
});

// ---------------------------------------------------------------------------
// DELETE /mutes/room/:roomId
// ---------------------------------------------------------------------------

export const unmuteRoom = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { roomId } = req.params;

  await supabase
    .from('mutes')
    .delete()
    .eq('user_id', userId)
    .eq('muted_room_id', roomId);

  res.json({ ok: true, muted: false });
});
