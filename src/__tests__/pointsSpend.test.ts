/**
 * Points spend — insufficient balance path.
 *
 * The RPC `spend_points` returns `null` (or an error) when the user's balance is
 * below the item cost. The controller must:
 *   1. Roll back the pre-recorded marketplace_transactions row (we insert before
 *      the RPC so we can attribute the attempt, but it mustn't survive a fail)
 *   2. Return 402 Payment Required with INSUFFICIENT_POINTS
 *
 * Why this test matters: this is the only place in the codebase where we
 * compensate for an RPC failure by deleting a row we just wrote. If that
 * delete ever regresses, users see phantom transactions without a balance
 * debit — or worse, with one. Either way it's a silent money bug.
 */

import { Request, Response } from 'express';

// ─── Supabase mock ──────────────────────────────────────────────────────────
// Chainable query builder that returns whatever the last terminal call resolves to.
const insertMock = jest.fn().mockResolvedValue({ data: null, error: null });
const deleteEqMock = jest.fn().mockResolvedValue({ data: null, error: null });
const deleteMock = jest.fn(() => ({ eq: deleteEqMock }));
const singleMock = jest.fn();
const rpcMock = jest.fn();

const supabaseMock = {
  from: jest.fn((_table: string) => ({
    insert: insertMock,
    delete: deleteMock,
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({ single: singleMock })),
          })),
        })),
      })),
    })),
  })),
  rpc: rpcMock,
};

jest.mock('../lib/supabaseClient', () => ({ supabase: supabaseMock }));

// Import AFTER the mock is registered
import { spendPoints } from '../controllers/pointsController';

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

/** catchAsync returns a RequestHandler that doesn't surface the inner promise.
 *  Flush the microtask queue a few times so all awaited DB/RPC calls settle. */
const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r));
};

describe('POST /points/spend — insufficient balance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 402 + INSUFFICIENT_POINTS and rolls back the transaction row', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'insufficient' } });
    singleMock.mockResolvedValue({ data: { id: 'txn-42' }, error: null });

    const req = {
      body: { item: 'coaching_session' }, // cost 500 PP
      user: { id: 'user-abc' },
    } as unknown as Request;
    const res = mockRes();

    spendPoints(req, res, jest.fn());
    await flush();

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'INSUFFICIENT_POINTS',
      needed: 500,
    }));
    // The rollback must target the row we just inserted.
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'txn-42');
    // We must not double-insert on failure.
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown items with 400 BadRequest (does not hit supabase)', async () => {
    const req = {
      body: { item: 'not_a_real_item' },
      user: { id: 'user-abc' },
    } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    spendPoints(req, res, next);
    await flush();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(rpcMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with 401 (does not hit supabase)', async () => {
    const req = { body: { item: 'goal_slot' }, user: undefined } as unknown as Request;
    const res = mockRes();

    spendPoints(req, res, jest.fn());
    await flush();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
