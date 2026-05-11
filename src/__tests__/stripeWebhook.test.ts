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
const constructEventMock = jest.fn();
const subscriptionsRetrieveMock = jest.fn();
const customersRetrieveMock = jest.fn();

jest.mock('stripe', () => {
  const MockStripe: any = jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: constructEventMock },
    subscriptions: { retrieve: subscriptionsRetrieveMock },
    customers:     { retrieve: customersRetrieveMock },
  }));
  MockStripe.Event = class {};
  return { __esModule: true, default: MockStripe };
});

// ─── Shared mock helpers ────────────────────────────────────────────────────
const profilesSelectSingleMock = jest.fn().mockResolvedValue({ data: { praxis_points: 100 }, error: null });
const profilesUpdateEqMock = jest.fn().mockResolvedValue({ data: null, error: null });
const profilesUpdateMock = jest.fn(() => ({ eq: profilesUpdateEqMock }));
const txnInsertMock = jest.fn().mockResolvedValue({ data: null, error: null });
const txnMaybeSingleMock = jest.fn();

const buildTxnSelectChain = () => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      eq: jest.fn(() => ({
        contains: jest.fn(() => ({ maybeSingle: txnMaybeSingleMock })),
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

// ─── Subscription table mock ────────────────────────────────────────────────
const subUpsertMock = jest.fn().mockResolvedValue({ data: null, error: null });
const subUpdateEqMock = jest.fn().mockResolvedValue({ data: null, error: null });
const subUpdateMock = jest.fn(() => ({ eq: subUpdateEqMock }));
const subDeleteEqMock = jest.fn().mockResolvedValue({ data: null, error: null });
const subDeleteMock = jest.fn(() => ({ eq: subDeleteEqMock }));
const subMaybeSingleMock = jest.fn();
const subSelectEqMock = jest.fn(() => ({ maybeSingle: subMaybeSingleMock }));
const subSelectMock = jest.fn(() => ({ eq: subSelectEqMock }));

const buildSubChain = () => ({
  select: subSelectMock,
  insert: jest.fn(),
  upsert: subUpsertMock,
  update: subUpdateMock,
  delete: subDeleteMock,
});

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === 'profiles') return buildProfilesChain();
      if (table === 'user_subscriptions') return buildSubChain();
      return buildTxnSelectChain();
    }),
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
    txnMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(txnInsertMock).toHaveBeenCalledTimes(1);
    expect(profilesUpdateMock).toHaveBeenCalledWith({ praxis_points: 100 + 1100 });
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('short-circuits and does NOT credit again on a duplicate delivery', async () => {
    txnMaybeSingleMock.mockResolvedValue({ data: { id: 'existing-txn' }, error: null });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(txnInsertMock).not.toHaveBeenCalled();
    expect(profilesUpdateMock).not.toHaveBeenCalled();
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

// ─── Subscription webhook event fixtures ─────────────────────────────────────

const SUB_EVENT = {
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_sub_1',
      customer: 'cus_sub_abc',
      subscription: 'sub_xyz_789',
      metadata: { userId: 'user-42' },
      mode: 'subscription',
    },
  },
};

const SUB_OBJECT = {
  id: 'sub_xyz_789',
  status: 'active',
  customer: 'cus_sub_abc',
  metadata: { userId: 'user-42' },
  items: { data: [{ price: { id: 'price_monthly', product: 'prod_premium' } }] },
  current_period_start: 1710000000,
  current_period_end:   1712592000,
  created: 1710000000,
};

const SUB_UPDATED_EVENT = {
  type: 'customer.subscription.updated',
  data: { object: { ...SUB_OBJECT } },
};

const SUB_DELETED_EVENT = {
  type: 'customer.subscription.deleted',
  data: { object: { ...SUB_OBJECT, status: 'canceled' } },
};

describe('handleWebhook — subscription checkout.session.completed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    constructEventMock.mockReturnValue(SUB_EVENT);
    subscriptionsRetrieveMock.mockResolvedValue(SUB_OBJECT);
  });

  it('creates a subscription row on the first delivery', async () => {
    subMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith('sub_xyz_789');
    expect(subUpsertMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('short-circuits and updates status on a duplicate delivery', async () => {
    subMaybeSingleMock.mockResolvedValue({ data: { id: 'sub_xyz_789', status: 'active' }, error: null });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(subscriptionsRetrieveMock).not.toHaveBeenCalled();
    expect(subUpdateMock).toHaveBeenCalled();
    expect(subUpsertMock).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('returns 400 when session metadata lacks userId', async () => {
    const noUserEvent = {
      ...SUB_EVENT,
      data: { object: { ...SUB_EVENT.data.object, metadata: {} } },
    };
    constructEventMock.mockReturnValue(noUserEvent);

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(subUpsertMock).not.toHaveBeenCalled();
  });
});

describe('handleWebhook — customer.subscription.updated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    constructEventMock.mockReturnValue(SUB_UPDATED_EVENT);
    customersRetrieveMock.mockResolvedValue({ metadata: { userId: 'user-42' } });
  });

  it('upserts the subscription with latest status', async () => {
    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(customersRetrieveMock).toHaveBeenCalledWith('cus_sub_abc');
    expect(subUpsertMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('returns 400 when userId cannot be resolved from subscription or customer', async () => {
    customersRetrieveMock.mockResolvedValue({ metadata: {} });

    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(subUpsertMock).not.toHaveBeenCalled();
  });
});

describe('handleWebhook — customer.subscription.deleted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    constructEventMock.mockReturnValue(SUB_DELETED_EVENT);
    customersRetrieveMock.mockResolvedValue({ metadata: { userId: 'user-42' } });
  });

  it('deletes the subscription row', async () => {
    const res = makeRes();
    await handleWebhook(makeReq(), res);
    await flush();

    expect(subDeleteMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
