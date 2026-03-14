import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

export const sendRequest = catchAsync(async (req: Request, res: Response) => {
  const requesterId = req.user?.id;
  if (!requesterId) throw new UnauthorizedError('Not authenticated.');
  const { targetId, nodeId, nodeName } = req.body;
  if (!targetId || !nodeId) throw new BadRequestError('targetId and nodeId required.');

  const { data, error } = await supabase
    .from('sparring_requests')
    .upsert({
      requester_id: requesterId,
      target_id: targetId,
      node_id: nodeId,
      node_name: nodeName ?? null,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'requester_id,target_id,node_id' })
    .select('id, status')
    .single();

  if (error) throw error;

  await supabase.from('notifications').insert({
    user_id: targetId,
    type: 'sparring_request',
    title: 'Spar? 🥊',
    body: `Someone wants to spar on "${nodeName ?? 'a goal'}". Check it out.`,
    metadata: { request_id: data.id, node_id: nodeId },
  }).catch(() => {});

  res.status(201).json(data);
});

export const respondRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { requestId, accept, myNodeId } = req.body;
  if (!requestId || accept === undefined) throw new BadRequestError('requestId and accept required.');

  const { data: sparReq, error: fetchErr } = await supabase
    .from('sparring_requests')
    .select('id, requester_id, target_id, node_id, node_name, status')
    .eq('id', requestId)
    .eq('target_id', userId)
    .single();

  if (fetchErr || !sparReq) return res.status(404).json({ error: 'Request not found.' });
  if (sparReq.status !== 'pending') return res.status(409).json({ error: 'Already responded.' });

  const newStatus = accept ? 'accepted' : 'rejected';
  await supabase.from('sparring_requests').update({ status: newStatus }).eq('id', requestId);

  if (accept) {
    await supabase.from('sparring_partners').upsert({
      user_a: sparReq.requester_id,
      user_b: sparReq.target_id,
      node_id_a: sparReq.node_id,
      node_id_b: myNodeId ?? sparReq.node_id,
      joint_streak: 0,
    }, { onConflict: 'user_a,user_b,node_id_a' });

    await supabase.from('notifications').insert({
      user_id: sparReq.requester_id,
      type: 'sparring_accepted',
      title: 'Sparring accepted! 🥊',
      body: `Your spar request on "${sparReq.node_name ?? 'a goal'}" was accepted.`,
      metadata: { request_id: requestId },
    }).catch(() => {});
  }

  res.json({ status: newStatus });
});

export const getIncoming = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('sparring_requests')
    .select('id, requester_id, node_id, node_name, created_at, expires_at')
    .eq('target_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  const ids = (data ?? []).map((r: any) => r.requester_id);
  let profiles: Record<string, { name: string; avatar_url: string | null }> = {};
  if (ids.length > 0) {
    const { data: pData } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', ids);
    for (const p of pData ?? []) profiles[p.id] = { name: p.name, avatar_url: p.avatar_url };
  }

  res.json((data ?? []).map((r: any) => ({ ...r, requester: profiles[r.requester_id] ?? null })));
});

export const getPartners = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('sparring_partners')
    .select('id, user_a, user_b, node_id_a, node_id_b, joint_streak, last_joint_checkin, created_at')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('joint_streak', { ascending: false });

  if (error) throw error;
  res.json(data ?? []);
});

export const toggleOpen = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { nodeId, open } = req.body;
  if (!nodeId || open === undefined) throw new BadRequestError('nodeId and open required.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('sparring_open_node_ids')
    .eq('id', userId)
    .single();

  const current: string[] = Array.isArray(profile?.sparring_open_node_ids) ? profile.sparring_open_node_ids : [];
  const updated = open
    ? Array.from(new Set([...current, nodeId]))
    : current.filter((id: string) => id !== nodeId);

  await supabase.from('profiles').update({ sparring_open_node_ids: updated }).eq('id', userId);
  res.json({ sparring_open_node_ids: updated });
});
