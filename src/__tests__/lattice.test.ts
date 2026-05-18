/**
 * Lattice API tests — device registry + job queue
 * Uses supertest + mocked Supabase (no live DB required).
 */

import request from 'supertest';
import app from '../app';

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Chain builder: from().select().eq()... → resolves with { data, error }
type MockResult = { data: any; error: any };

const makeMockChain = (result: MockResult) => {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(result),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
    [Symbol.iterator]: undefined,
  };
  // Make the chain itself thenable (for `await supabase.from(...).insert(...)`)
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });
  return chain;
};

jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../lib/supabaseClient';
const mockFrom = supabase.from as jest.Mock;

// ── Auth mock (injects req.user) ──────────────────────────────────────────────
jest.mock('../middleware/authenticateToken', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-test-uuid' };
    next();
  },
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/lattice/devices/register', () => {
  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/lattice/devices/register')
      .set('Authorization', 'Bearer test')
      .send({ name: 'Printer' }); // missing slug + type
    expect(res.status).toBe(400);
  });

  it('rejects invalid device type', async () => {
    mockFrom.mockReturnValue(makeMockChain({ data: null, error: null }));
    const res = await request(app)
      .post('/api/lattice/devices/register')
      .set('Authorization', 'Bearer test')
      .send({ name: 'Thing', slug: 'thing', type: 'invalid_type' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/type must be one of/i);
  });

  it('registers a device and returns api_key', async () => {
    const fakeDevice = {
      id: 'dev-uuid-1',
      name: 'Prusa MK4',
      slug: 'prusa-mk4',
      type: '3dprinter',
      capabilities: ['fdm', 'pla'],
      status: 'offline',
      created_at: new Date().toISOString(),
    };
    mockFrom.mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: fakeDevice, error: null }),
        }),
      }),
    });

    const res = await request(app)
      .post('/api/lattice/devices/register')
      .set('Authorization', 'Bearer test')
      .send({ name: 'Prusa MK4', slug: 'prusa-mk4', type: '3dprinter', capabilities: ['fdm', 'pla'] });

    expect(res.status).toBe(201);
    expect(res.body.api_key).toMatch(/^dk_/);
    expect(res.body.slug).toBe('prusa-mk4');
  });
});

describe('POST /api/lattice/devices/heartbeat', () => {
  it('rejects missing x-device-key', async () => {
    const res = await request(app)
      .post('/api/lattice/devices/heartbeat')
      .send({ status: 'online' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid device key', async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    });

    const res = await request(app)
      .post('/api/lattice/devices/heartbeat')
      .set('x-device-key', 'dk_invalid')
      .send({ status: 'online' });
    expect(res.status).toBe(401);
  });

  it('accepts valid device key and updates status', async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'dev-uuid-1', slug: 'prusa-mk4', status: 'online' },
              error: null,
            }),
          }),
        }),
      }),
    });

    const res = await request(app)
      .post('/api/lattice/devices/heartbeat')
      .set('x-device-key', 'dk_validkey')
      .send({ status: 'online' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('online');
  });
});

describe('POST /api/lattice/jobs', () => {
  it('rejects missing device_id', async () => {
    const res = await request(app)
      .post('/api/lattice/jobs')
      .set('Authorization', 'Bearer test')
      .send({ type: 'print_file' });
    expect(res.status).toBe(400);
  });

  it('submits a job and returns it', async () => {
    // First call: verify device ownership
    // Second call: insert job
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'dev-uuid-1', slug: 'prusa-mk4', status: 'online' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // insert job
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'job-uuid-1',
                device_id: 'dev-uuid-1',
                type: 'print_file',
                status: 'pending',
                submitted_by: 'aura',
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      };
    });

    const res = await request(app)
      .post('/api/lattice/jobs')
      .set('Authorization', 'Bearer test')
      .send({ device_id: 'dev-uuid-1', type: 'print_file', submitted_by: 'aura' });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('print_file');
    expect(res.body.submitted_by).toBe('aura');
  });
});

describe('PATCH /api/lattice/jobs/:id/status', () => {
  it('rejects missing x-device-key', async () => {
    const res = await request(app)
      .patch('/api/lattice/jobs/job-uuid-1/status')
      .send({ status: 'done' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid status values', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'dev-uuid-1' }, error: null,
          }),
        }),
      }),
    });

    const res = await request(app)
      .patch('/api/lattice/jobs/job-uuid-1/status')
      .set('x-device-key', 'dk_valid')
      .send({ status: 'exploded' }); // invalid
    expect(res.status).toBe(400);
  });
});

describe('POST /api/lattice/jobs/poll', () => {
  it('rejects missing x-device-key', async () => {
    const res = await request(app).post('/api/lattice/jobs/poll');
    expect(res.status).toBe(401);
  });

  it('returns pending jobs for valid device key', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'dev-uuid-1', user_id: 'user-test-uuid' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [
                    { id: 'job-1', type: 'print_file', payload: {}, goal_id: null },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    });

    const res = await request(app)
      .post('/api/lattice/jobs/poll')
      .set('x-device-key', 'dk_valid');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].type).toBe('print_file');
  });
});
