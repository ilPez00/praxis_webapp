import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError, ForbiddenError } from '../utils/appErrors';
import logger from '../utils/logger';

/**
 * POST /api/lattice/jobs
 * Submit a job to a device queue.
 * submitted_by defaults to 'user'; Axiom/MCP can override.
 */
export const submitJob = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { device_id, type, payload, goal_id, submitted_by } = req.body;
    if (!device_id || !type) throw new BadRequestError('device_id, type required');

    const validSubmitters = ['user', 'axiom', 'aura', 'mcp'];
    const submitter = validSubmitters.includes(submitted_by) ? submitted_by : 'user';

    // Verify device belongs to user
    const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, slug, status')
        .eq('id', device_id)
        .eq('user_id', userId)
        .single();

    if (devErr || !device) throw new NotFoundError('Device not found');

    const { data, error } = await supabase
        .from('device_jobs')
        .insert({
            user_id:      userId,
            device_id,
            type,
            payload:      payload ?? {},
            goal_id:      goal_id ?? null,
            submitted_by: submitter,
            status:       'pending',
        })
        .select('id, device_id, type, status, submitted_by, created_at')
        .single();

    if (error) throw new BadRequestError(error.message);
    logger.info(`job submitted: ${type} → device ${device.slug} by ${submitter}`);

    res.status(201).json(data);
});

/** GET /api/lattice/jobs — list user's jobs (optional ?device_id=, ?status=, ?limit=) */
export const listJobs = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { device_id, status, limit } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 200);

    let q = supabase
        .from('device_jobs')
        .select('id, device_id, type, status, submitted_by, progress_pct, result, error_msg, created_at, started_at, completed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(take);

    if (device_id) q = q.eq('device_id', device_id as string);
    if (status)    q = q.eq('status', status as string);

    const { data, error } = await q;
    if (error) throw new BadRequestError(error.message);
    res.json({ jobs: data ?? [] });
});

/** GET /api/lattice/jobs/:id */
export const getJob = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { data, error } = await supabase
        .from('device_jobs')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', userId)
        .single();

    if (error || !data) throw new NotFoundError('Job not found');
    res.json(data);
});

/** DELETE /api/lattice/jobs/:id — cancel a pending job */
export const cancelJob = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { data, error } = await supabase
        .from('device_jobs')
        .update({ status: 'cancelled' })
        .eq('id', req.params.id)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .select('id, status')
        .single();

    if (error || !data) throw new NotFoundError('Job not found or not cancellable');
    res.json({ ok: true, id: data.id, status: data.status });
});

/**
 * POST /api/lattice/jobs/poll
 * Device agent polls for its pending jobs.
 * Authenticated with x-device-key header.
 */
export const pollJobs = catchAsync(async (req: Request, res: Response) => {
    const apiKey = req.headers['x-device-key'] as string | undefined;
    if (!apiKey) throw new UnauthorizedError('x-device-key header required');

    const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id, user_id')
        .eq('api_key', apiKey)
        .single();

    if (devErr || !device) throw new UnauthorizedError('Invalid device key');

    const { data, error } = await supabase
        .from('device_jobs')
        .select('id, type, payload, goal_id')
        .eq('device_id', device.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

    if (error) throw new BadRequestError(error.message);
    res.json({ jobs: data ?? [] });
});

/**
 * PATCH /api/lattice/jobs/:id/status
 * Device agent updates job execution state.
 * Authenticated with x-device-key header.
 */
export const updateJobStatus = catchAsync(async (req: Request, res: Response) => {
    const apiKey = req.headers['x-device-key'] as string | undefined;
    if (!apiKey) throw new UnauthorizedError('x-device-key header required');

    const { data: device, error: devErr } = await supabase
        .from('devices')
        .select('id')
        .eq('api_key', apiKey)
        .single();

    if (devErr || !device) throw new UnauthorizedError('Invalid device key');

    const { status, progress_pct, result, error_msg } = req.body;
    const validStatuses = ['running', 'done', 'failed'];
    if (!validStatuses.includes(status)) throw new BadRequestError('status must be running|done|failed');

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status };
    if (progress_pct !== undefined) patch.progress_pct = Math.min(100, Math.max(0, Number(progress_pct)));
    if (status === 'running' && !patch.started_at) patch.started_at = now;
    if (status === 'done' || status === 'failed') patch.completed_at = now;
    if (result !== undefined)    patch.result    = result;
    if (error_msg !== undefined) patch.error_msg = error_msg;

    const { data, error } = await supabase
        .from('device_jobs')
        .update(patch)
        .eq('id', req.params.id)
        .eq('device_id', device.id)
        .select('id, status, progress_pct, goal_id')
        .single();

    if (error || !data) throw new NotFoundError('Job not found for this device');

    // If job done and linked to a goal, bump goal progress by 10pp (capped at 100)
    if (status === 'done' && data.goal_id) {
        const { data: node } = await supabase
            .from('goal_tree_nodes')
            .select('id, progress')
            .eq('id', data.goal_id)
            .single();

        if (node) {
            const newProgress = Math.min(1, (node.progress ?? 0) + 0.10);
            await supabase
                .from('goal_tree_nodes')
                .update({ progress: newProgress })
                .eq('id', data.goal_id);
        }
    }

    logger.info(`job ${data.id} → ${status} (device ${device.id})`);
    res.json({ ok: true, ...data });
});
