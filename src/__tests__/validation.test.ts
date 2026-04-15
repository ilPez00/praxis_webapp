/**
 * Validation Middleware Tests
 * Tests for Zod validation middleware
 *
 * We bypass authenticateToken so the test hits Zod validation instead of
 * auth — these tests are about the validator's 400 response shape, not auth.
 * Auth is covered separately in api.test.ts ("Protected Endpoints").
 */

// Must be registered before `import app` so the middleware is replaced.
jest.mock('../middleware/authenticateToken', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: '00000000-0000-0000-0000-000000000000' };
    next();
  },
}));

import request from 'supertest';
import app from '../app';

describe('Body Validation', () => {
  describe('POST /api/bets', () => {
    it('should reject bet without required fields', async () => {
      const res = await request(app)
        .post('/api/bets')
        .set('Authorization', 'Bearer test-token')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('should reject bet with invalid goalName', async () => {
      const res = await request(app)
        .post('/api/bets')
        .set('Authorization', 'Bearer test-token')
        .send({
          goalName: '',
          deadline: '2026-12-31T23:59:59Z',
          stakePoints: 100,
        });
      
      expect(res.status).toBe(400);
    });

    it('should reject bet with invalid stakePoints', async () => {
      const res = await request(app)
        .post('/api/bets')
        .set('Authorization', 'Bearer test-token')
        .send({
          goalName: 'Test Goal',
          deadline: '2026-12-31T23:59:59Z',
          stakePoints: -10,
        });
      
      expect(res.status).toBe(400);
    });

    it('should reject bet with invalid deadline format', async () => {
      const res = await request(app)
        .post('/api/bets')
        .set('Authorization', 'Bearer test-token')
        .send({
          goalName: 'Test Goal',
          deadline: 'not-a-date',
          stakePoints: 100,
        });
      
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should reject profile update with invalid bio length', async () => {
      const res = await request(app)
        .put('/api/users/test-id')
        .set('Authorization', 'Bearer test-token')
        .send({
          bio: 'x'.repeat(1000),
        });
      
      expect(res.status).toBe(400);
    });
  });
});

// Query validation and param-level UUID validation are not wired on /api/search
// or /api/posts/:id today — adding them just to satisfy a test would be
// reverse-TDD. When those endpoints grow Zod query/params schemas, re-enable
// the tests that used to live here (see git blame for the aspirational version).
