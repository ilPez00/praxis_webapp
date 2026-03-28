/**
 * Schema Validation Tests
 * Unit tests for Zod schemas
 */

import { registerSchema, loginSchema, updateProfileSchema } from '../schemas/userSchemas';
import { createBetSchema } from '../schemas/bettingSchemas';

describe('User Schemas', () => {
  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const data = {
        email: 'test@example.com',
        password: 'TestPass123',
        name: 'Test User',
      };
      expect(() => registerSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid email format', () => {
      const data = {
        email: 'not-an-email',
        password: 'TestPass123',
        name: 'Test',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject weak password', () => {
      const data = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject password without letter and number', () => {
      const data = {
        email: 'test@example.com',
        password: 'password',
        name: 'Test',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should reject invalid name characters', () => {
      const data = {
        email: 'test@example.com',
        password: 'TestPass123',
        name: 'Test@User',
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
      };
      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    it('should reject login without email', () => {
      const data = {
        password: 'password123',
      };
      expect(() => loginSchema.parse(data)).toThrow();
    });

    it('should reject login without password', () => {
      const data = {
        email: 'test@example.com',
      };
      expect(() => loginSchema.parse(data)).toThrow();
    });
  });

  describe('updateProfileSchema', () => {
    it('should validate correct profile update', () => {
      const data = {
        name: 'Updated Name',
        bio: 'My bio',
      };
      expect(() => updateProfileSchema.parse(data)).not.toThrow();
    });

    it('should allow optional fields', () => {
      const data = {
        name: 'Updated Name',
      };
      expect(() => updateProfileSchema.parse(data)).not.toThrow();
    });

    it('should reject bio too long', () => {
      const data = {
        bio: 'x'.repeat(600),
      };
      expect(() => updateProfileSchema.parse(data)).toThrow();
    });
  });
});

describe('Betting Schemas', () => {
  describe('createBetSchema', () => {
    it('should validate correct bet data', () => {
      const data = {
        goalName: 'Lose 10 lbs',
        deadline: '2026-12-31T23:59:59.000Z',
        stakePoints: 100,
        opponentType: 'self' as const,
      };
      expect(() => createBetSchema.parse(data)).not.toThrow();
    });

    it('should reject empty goal name', () => {
      const data = {
        goalName: '',
        deadline: '2026-12-31T23:59:59.000Z',
        stakePoints: 100,
      };
      expect(() => createBetSchema.parse(data)).toThrow();
    });

    it('should reject negative stake points', () => {
      const data = {
        goalName: 'Test',
        deadline: '2026-12-31T23:59:59.000Z',
        stakePoints: -10,
      };
      expect(() => createBetSchema.parse(data)).toThrow();
    });

    it('should reject stake points too high', () => {
      const data = {
        goalName: 'Test',
        deadline: '2026-12-31T23:59:59.000Z',
        stakePoints: 20000,
      };
      expect(() => createBetSchema.parse(data)).toThrow();
    });

    it('should reject invalid opponent type', () => {
      const data = {
        goalName: 'Test',
        deadline: '2026-12-31T23:59:59.000Z',
        stakePoints: 100,
        opponentType: 'invalid',
      };
      expect(() => createBetSchema.parse(data)).toThrow();
    });

    it('should accept optional goalNodeId', () => {
      const data = {
        goalNodeId: '123e4567-e89b-12d3-a456-426614174000',
        goalName: 'Test',
        deadline: '2026-12-31T23:59:59.000Z',
        stakePoints: 100,
      };
      expect(() => createBetSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid UUID for goalNodeId', () => {
      const data = {
        goalNodeId: 'not-a-uuid',
        goalName: 'Test',
        deadline: '2026-12-31T23:59:59.000Z',
        stakePoints: 100,
      };
      expect(() => createBetSchema.parse(data)).toThrow();
    });
  });
});
