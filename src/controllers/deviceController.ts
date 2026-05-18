import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError, ForbiddenError } from '../utils/appErrors';
import { randomBytes } from 'crypto';
import logger from '../utils/logger';

function generateDeviceKey(): string {
    return 'dk_' + randomBytes(32).toString('hex');
}

/**
 * POST /api/lattice/devices/register
 * Device self-registers (called once from the device SDK).
 * Returns api_key that the device uses for all subsequent calls.
 */
export const registerDevice = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { name, slug, type, capabilities, metadata } = req.body;
    if (!name || !slug || !type) throw new BadRequestError('name, slug, type required');

    const validTypes = ['3dprinter','cnc_mill','computer','smart_home','wearable','camera','server','custom'];
    if (!validTypes.includes(type)) throw new BadRequestError(`type must be one of: ${validTypes.join(', ')}`);

    const apiKey = generateDeviceKey();

    const { data, error } = await supabase
        .from('devices')
        .upsert({
            user_id:      userId,
            name,
            slug,
            type,
            capabilities: capabilities ?? [],
            metadata:     metadata ?? {},
            api_key:      apiKey,
            status:       'offline',
        }, { onConflict: 'user_id,slug' })
        .select('id, name, slug, type, capabilities, status, created_at')
        .single();

    if (error) throw new BadRequestError(error.message);
    logger.info(`device registered: ${slug} for user ${userId}`);

    res.status(201).json({ ...data, api_key: apiKey });
});

/** GET /api/lattice/devices — list user's devices */
export const listDevices = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { data, error } = await supabase
        .from('devices')
        .select('id, name, slug, type, capabilities, status, last_seen, metadata, created_at')
        .eq('user_id', userId)
        .order('name');

    if (error) throw new BadRequestError(error.message);
    res.json({ devices: data ?? [] });
});

/** GET /api/lattice/devices/:id — single device status */
export const getDevice = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { data, error } = await supabase
        .from('devices')
        .select('id, name, slug, type, capabilities, status, last_seen, metadata')
        .eq('id', req.params.id)
        .eq('user_id', userId)
        .single();

    if (error || !data) throw new NotFoundError('Device not found');
    res.json(data);
});

/** DELETE /api/lattice/devices/:id — remove device */
export const deleteDevice = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedError('Not authenticated');

    const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', userId);

    if (error) throw new BadRequestError(error.message);
    res.status(204).end();
});

/**
 * POST /api/lattice/devices/heartbeat
 * Called by device agent every ~30s to report status.
 * Authenticated with device api_key (x-device-key header).
 */
export const heartbeat = catchAsync(async (req: Request, res: Response) => {
    const apiKey = req.headers['x-device-key'] as string | undefined;
    if (!apiKey) throw new UnauthorizedError('x-device-key header required');

    const { status, metadata } = req.body;

    const { data, error } = await supabase
        .from('devices')
        .update({
            status:    status ?? 'online',
            last_seen: new Date().toISOString(),
            ...(metadata ? { metadata } : {}),
        })
        .eq('api_key', apiKey)
        .select('id, slug, status')
        .single();

    if (error || !data) throw new UnauthorizedError('Invalid device key');
    res.json({ ok: true, id: data.id, status: data.status });
});
