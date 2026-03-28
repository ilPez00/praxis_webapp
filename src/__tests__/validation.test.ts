/**
 * Validation Middleware Tests
 * Tests for Zod validation middleware
 */

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

describe('Query Validation', () => {
  it('should handle invalid query parameters', async () => {
    const res = await request(app)
      .get('/api/search?page=-1');
    
    expect(res.status).toBe(400);
  });
});

describe('Parameter Validation', () => {
  it('should handle invalid UUID parameters', async () => {
    const res = await request(app)
      .get('/api/posts/invalid-uuid');
    
    expect(res.status).toBe(404);
  });
});
