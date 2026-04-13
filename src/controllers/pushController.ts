import { Request, Response } from 'express';
import webpush from 'web-push';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';

// ---------------------------------------------------------------------------
// VAPID configuration
// ---------------------------------------------------------------------------

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     || 'mailto:praxis@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  logger.info('[Push] VAPID keys configured');
} else {
  logger.warn('[Push] VAPID keys missing — push notifications disabled');
}

// ---------------------------------------------------------------------------
// GET /push/vapid-key — public key the frontend needs
// ---------------------------------------------------------------------------

export const getVapidKey = (_req: Request, res: Response) => {
  res.json({ key: VAPID_PUBLIC });
};

// ---------------------------------------------------------------------------
// POST /push/subscribe — store the push subscription for the current user
// Body: { subscription: PushSubscription }
// ---------------------------------------------------------------------------

export const subscribe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { subscription } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ message: 'Invalid push subscription.' });
  }

  // Upsert: one row per (user, endpoint) — avoids duplicates on re-subscribe
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id:  userId,
        endpoint: subscription.endpoint,
        keys:     subscription.keys, // { p256dh, auth }
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    );

  if (error) {
    logger.warn('[Push] subscribe upsert failed:', error.message);
    return res.status(500).json({ message: 'Failed to save subscription.' });
  }

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /push/unsubscribe — remove a subscription
// Body: { endpoint: string }
// ---------------------------------------------------------------------------

export const unsubscribe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ message: 'endpoint required.' });

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Internal: send push to all subscriptions for a given user
// Called from notificationController.pushNotification
// ---------------------------------------------------------------------------

export async function sendPush(userId: string, payload: { title: string; body?: string; link?: string; icon?: string }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return; // push not configured

  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', userId);

    if (!subs || subs.length === 0) return;

    const jsonPayload = JSON.stringify({
      title: payload.title,
      body:  payload.body || '',
      url:   payload.link || '/',
      icon:  payload.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
    });

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          jsonPayload,
          { TTL: 60 * 60 }, // 1 hour
        ),
      ),
    );

    // Clean up expired/invalid subscriptions (410 Gone or 404)
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        const status = (r.reason as any)?.statusCode;
        if (status === 410 || status === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subs[i].endpoint);
          logger.info(`[Push] Removed expired subscription for ${userId}`);
        } else {
          logger.warn(`[Push] Failed to send to ${userId}:`, (r.reason as any)?.message);
        }
      }
    }
  } catch (err: any) {
    logger.warn('[Push] sendPush error:', err?.message);
  }
}
