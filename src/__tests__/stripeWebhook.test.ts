/**
 * Stripe webhook — PP-purchase idempotency guard.
 *
 * Stripe retries webhooks on any non-2xx response or timeout. Without the guard
 * at stripeController.ts:151, a retry causes double-crediting:
 *   - user pays $9.99 once
 *   - webhook fires, credits 1,100 PP → 200 OK
 *   - Stripe retries anyway (network blip before our ACK reached them)
 *   - guard missing → another 1,100 PP credited → user is now +2,200 PP
 *
 * The guard queries marketplace_transactions for a row with the matching
 * stripe_session_id in metadata, and short-circuits if one exists.
 *
 * This test proves that a duplicate webhook for the same session.id does NOT
 * result in a second `profiles.update` call (which is what actually credits PP).
 */

import type { Request, Response } from 'express';

// ─── Stripe mock ─────────────────────────────────────────────────────────────
// We control constructEvent to return a canned PP-purchase session twice.
const constructEventMock = jest.fn();
jest.mock('stripe', () => {
  const MockStripe: any = jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: constructEventMock },
    subscriptions: { retrieve: jest.fn() },
    customers:     { retrieve: jest.fn() },
  }));
  // Re-export namespace-style types so `Stripe.Event` etc. don't crash at import.
  MockStripe.Event = class {};
  return { __esModule: true, default: MockStripe };
});

// ─── Supabase mock ───────────────────────────────────────────────────────────
// marketplace_transactions: first webhook → maybeSingle returns null (no prior row)
// Second webhook → maybeSingle returns a row (idempotency hit, should short-circuit)
const profilesSelectSingleMock = jest.fn().mockResolvedValue({ data: { praxis_points: 100 }, error: null });
const profilesUpdateEqMock = jest.fn().mockResolvedValue({ data: null, error: null });
const profilesUpdateMock = jest.fn(() => ({ eq: profilesUpdateEqMock }));
const txnInsertMock = jest.fn().mockResolvedValue({ data: null, error: null });
const maybeSingleMock = jest.fn();

const buildTxnSelectChain = () => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      eq: jest.fn(() => ({
        contains: jest.fn(() => ({ maybeSingle: maybeSingleMock })),
      })),
    })),
  })),
  insert: txnInsertMock,
});

const buildProfilesChain = () => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({ single: profilesSelectSingleMock })),
  })),
  update: profilesUpdateMock,
});

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn((table: string) =>
      table === 'profiles' ? buildProfilesChain() : buildTxnSelectChain()
    ),
  },
}));

// Set env so the controller doesn't bail on missing webhook secret.
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.STRIPE_SECRET_KEY     = 'sk_test_dummy';

// Import AFTER mocks
import { handleWebhook } from '../controllers/stripeController';

const makeReq = () => ({
  headers: { 'stripe-signature': 't=1,v1=fake' },
  body: Buffer.from('{}'),
} as unknown as Request);

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.send   = jest.fn().mockReturnValue(res);
  return res as Response;
};

const PP_SESSION_EVENT = {
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_abc123',
      customer: 'cus_xxx',
      metadata: {
        purchase_type: 'pp',
        userId: 'user-42',
        pp: '1100',
      },
    },
  },
};

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r));
};

describe('handleWebhook — PP purchase idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    constructEventMock.mockReturnValue(PP_SESSION_EVENT);
  });

  it('credits PP once on the first delivery', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(txnInsertMock).toHaveBeenCalledTimes(1);
    expect(profilesUpdateMock).toHaveBeenCalledWith({ praxis_points: 100 + 1100 });
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('short-circuits and does NOT credit again on a duplicate delivery', async () => {
    // Simulate the row inserted by a prior successful delivery.
    maybeSingleMock.mockResolvedValue({ data: { id: 'existing-txn' }, error: null });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    // The idempotency guard must prevent ANY write side-effect on a duplicate.
    expect(txnInsertMock).not.toHaveBeenCalled();
    expect(profilesUpdateMock).not.toHaveBeenCalled();
    // Must still 200 so Stripe stops retrying.
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('rejects webhooks with bad signature (signature error propagates as 400)', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload.');
    });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
    expect(txnInsertMock).not.toHaveBeenCalled();
  });
});
