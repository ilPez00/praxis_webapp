import { registerSchema, loginSchema, updateProfileSchema, deleteAccountSchema, anonymizeAccountSchema } from '../schemas/userSchemas';
import { createBetSchema } from '../schemas/bettingSchemas';
import { createGoalSchema, updateProgressSchema } from '../schemas/goalSchemas';
import { sendMessageSchema, createChatRoomSchema } from '../schemas/messageSchemas';
import { createPostBodySchema, addCommentBodySchema, votePostBodySchema } from '../schemas/postSchemas';
import { trackerEntrySchema, trackerLogSchema, createTrackerSchema } from '../schemas/trackerSchemas';
import { grantPointsBodySchema, banUserBodySchema, togglePremiumBodySchema, promoteUserBodySchema, createChallengeBodySchema } from '../schemas/adminSchemas';

describe('User Schemas', () => {
  describe('registerSchema', () => {
    it('validates correct registration data', () => {
      const data = { email: 'test@example.com', password: 'TestPass123', name: 'Test User' };
      expect(() => registerSchema.parse(data)).not.toThrow();
    });

    it('rejects invalid email format', () => {
      expect(() => registerSchema.parse({ email: 'not-an-email', password: 'TestPass123', name: 'Test' })).toThrow();
    });

    it('rejects weak password', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'weak', name: 'Test' })).toThrow();
    });

    it('rejects password without letter', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: '12345678', name: 'Test' })).toThrow();
    });

    it('rejects password without number', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'abcdefgh', name: 'Test' })).toThrow();
    });

    it('rejects empty name', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'TestPass123', name: '' })).toThrow();
    });

    it('rejects name with invalid characters', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'TestPass123', name: 'Test@User' })).toThrow();
    });

    it('rejects name too short', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'TestPass123', name: 'A' })).toThrow();
    });

    it('rejects name too long', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'TestPass123', name: 'A'.repeat(101) })).toThrow();
    });

    it('rejects email too long', () => {
      expect(() => registerSchema.parse({ email: 'a'.repeat(250) + '@b.com', password: 'TestPass123', name: 'Test' })).toThrow();
    });

    it('allows hyphens and apostrophes in name', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'TestPass123', name: "O'Brien" })).not.toThrow();
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'TestPass123', name: 'Jean-Claude' })).not.toThrow();
    });

    it('accepts password at exactly 8 chars with letter+number', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'Abc12345', name: 'Test' })).not.toThrow();
    });
  });

  describe('loginSchema', () => {
    it('validates correct login data', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com', password: 'password123' })).not.toThrow();
    });

    it('rejects login without email', () => {
      expect(() => loginSchema.parse({ password: 'password123' })).toThrow();
    });

    it('rejects login without password', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com' })).toThrow();
    });

    it('rejects empty email', () => {
      expect(() => loginSchema.parse({ email: '', password: 'password123' })).toThrow();
    });

    it('rejects empty password', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow();
    });
  });

  describe('updateProfileSchema', () => {
    it('validates correct profile update', () => {
      expect(() => updateProfileSchema.parse({ name: 'Updated Name', bio: 'My bio' })).not.toThrow();
    });

    it('allows optional fields', () => {
      expect(() => updateProfileSchema.parse({ name: 'Updated Name' })).not.toThrow();
    });

    it('rejects bio too long', () => {
      expect(() => updateProfileSchema.parse({ bio: 'x'.repeat(600) })).toThrow();
    });

    it('rejects city too long', () => {
      expect(() => updateProfileSchema.parse({ city: 'x'.repeat(101) })).toThrow();
    });

    it('rejects invalid avatar URL', () => {
      expect(() => updateProfileSchema.parse({ avatar_url: 'not-a-url' })).toThrow();
    });

    it('accepts empty object (no fields to update)', () => {
      expect(() => updateProfileSchema.parse({})).not.toThrow();
    });
  });

  describe('deleteAccountSchema', () => {
    it('requires password', () => {
      expect(() => deleteAccountSchema.parse({ confirmText: 'DELETE' })).toThrow();
    });

    it('requires confirmText to be DELETE', () => {
      expect(() => deleteAccountSchema.parse({ password: 'mypassword', confirmText: 'delete' })).toThrow();
    });

    it('validates correct deletion data', () => {
      expect(() => deleteAccountSchema.parse({ password: 'mypassword', confirmText: 'DELETE' })).not.toThrow();
    });
  });

  describe('anonymizeAccountSchema', () => {
    it('requires confirmText to be ANONYMIZE', () => {
      expect(() => anonymizeAccountSchema.parse({ confirmText: 'anonymize' })).toThrow();
    });

    it('validates correct anonymize data', () => {
      expect(() => anonymizeAccountSchema.parse({ confirmText: 'ANONYMIZE' })).not.toThrow();
    });
  });
});

describe('Betting Schemas', () => {
  describe('createBetSchema', () => {
    it('validates correct bet data', () => {
      const data = { goalName: 'Lose 10 lbs', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100, opponentType: 'self' as const };
      expect(() => createBetSchema.parse(data)).not.toThrow();
    });

    it('rejects empty goal name', () => {
      expect(() => createBetSchema.parse({ goalName: '', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100 })).toThrow();
    });

    it('rejects negative stake points', () => {
      expect(() => createBetSchema.parse({ goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: -10 })).toThrow();
    });

    it('rejects zero stake points', () => {
      expect(() => createBetSchema.parse({ goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 0 })).toThrow();
    });

    it('rejects stake points exceeding 10000', () => {
      expect(() => createBetSchema.parse({ goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 20000 })).toThrow();
    });

    it('rejects invalid opponent type', () => {
      expect(() => createBetSchema.parse({ goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100, opponentType: 'invalid' })).toThrow();
    });

    it('accepts optional goalNodeId as valid UUID', () => {
      const data = { goalNodeId: '123e4567-e89b-12d3-a456-426614174000', goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100 };
      expect(() => createBetSchema.parse(data)).not.toThrow();
    });

    it('rejects invalid UUID for goalNodeId', () => {
      expect(() => createBetSchema.parse({ goalNodeId: 'not-a-uuid', goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100 })).toThrow();
    });

    it('defaults opponentType to self', () => {
      const result = createBetSchema.parse({ goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100 });
      expect(result.opponentType).toBe('self');
    });

    it('rejects goal name over 200 chars', () => {
      expect(() => createBetSchema.parse({ goalName: 'x'.repeat(201), deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100 })).toThrow();
    });

    it('rejects non-integer stake points', () => {
      expect(() => createBetSchema.parse({ goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 10.5 })).toThrow();
    });

    it('rejects invalid deadline format', () => {
      expect(() => createBetSchema.parse({ goalName: 'Test', deadline: 'not-a-date', stakePoints: 100 })).toThrow();
    });

    it('accepts duel opponent type', () => {
      const data = { goalName: 'Test', deadline: '2026-12-31T23:59:59.000Z', stakePoints: 100, opponentType: 'duel' as const };
      expect(() => createBetSchema.parse(data)).not.toThrow();
    });
  });
});

describe('Goal Schemas', () => {
  describe('createGoalSchema', () => {
    it('validates correct goal data', () => {
      const data = { name: 'Run a marathon', domain: 'Fitness' };
      expect(() => createGoalSchema.parse(data)).not.toThrow();
    });

    it('rejects name shorter than 3 chars', () => {
      expect(() => createGoalSchema.parse({ name: 'AB', domain: 'Fitness' })).toThrow();
    });

    it('rejects empty name', () => {
      expect(() => createGoalSchema.parse({ name: '', domain: 'Fitness' })).toThrow();
    });

    it('rejects name over 200 chars', () => {
      expect(() => createGoalSchema.parse({ name: 'x'.repeat(201), domain: 'Fitness' })).toThrow();
    });

    it('rejects invalid domain', () => {
      expect(() => createGoalSchema.parse({ name: 'Test', domain: 'InvalidDomain' })).toThrow();
    });

    it('accepts all valid domains', () => {
      const domains = ['Fitness', 'Career', 'Learning', 'Relationships', 'Finance', 'Creative', 'Health', 'Spiritual', 'Business', 'Personal'];
      for (const domain of domains) {
        expect(() => createGoalSchema.parse({ name: 'Test', domain })).not.toThrow();
      }
    });

    it('accepts optional description', () => {
      const data = { name: 'Test', domain: 'Fitness', description: 'A test goal' };
      expect(() => createGoalSchema.parse(data)).not.toThrow();
    });

    it('rejects description over 1000 chars', () => {
      expect(() => createGoalSchema.parse({ name: 'Test', domain: 'Fitness', description: 'x'.repeat(1001) })).toThrow();
    });

    it('accepts optional parent_id as valid UUID', () => {
      const data = { name: 'Test', domain: 'Fitness', parent_id: '123e4567-e89b-12d3-a456-426614174000' };
      expect(() => createGoalSchema.parse(data)).not.toThrow();
    });

    it('rejects invalid parent_id', () => {
      expect(() => createGoalSchema.parse({ name: 'Test', domain: 'Fitness', parent_id: 'not-uuid' })).toThrow();
    });
  });

  describe('updateProgressSchema', () => {
    it('validates progress between 0-100', () => {
      expect(() => updateProgressSchema.parse({ progress: 50 })).not.toThrow();
    });

    it('rejects negative progress', () => {
      expect(() => updateProgressSchema.parse({ progress: -1 })).toThrow();
    });

    it('rejects progress over 100', () => {
      expect(() => updateProgressSchema.parse({ progress: 101 })).toThrow();
    });

    it('accepts 0', () => {
      expect(() => updateProgressSchema.parse({ progress: 0 })).not.toThrow();
    });

    it('accepts 100', () => {
      expect(() => updateProgressSchema.parse({ progress: 100 })).not.toThrow();
    });

    it('rejects non-number', () => {
      expect(() => updateProgressSchema.parse({ progress: 'fifty' })).toThrow();
    });
  });
});

describe('Message Schemas', () => {
  describe('sendMessageSchema', () => {
    it('validates with receiverId', () => {
      const data = { receiverId: '123e4567-e89b-12d3-a456-426614174000', content: 'Hello' };
      expect(() => sendMessageSchema.parse(data)).not.toThrow();
    });

    it('validates with receiver_id (snake_case)', () => {
      const data = { receiver_id: '123e4567-e89b-12d3-a456-426614174000', content: 'Hello' };
      expect(() => sendMessageSchema.parse(data)).not.toThrow();
    });

    it('rejects empty content', () => {
      expect(() => sendMessageSchema.parse({ receiverId: '123e4567-e89b-12d3-a456-426614174000', content: '' })).toThrow();
    });

    it('rejects content over 5000 chars', () => {
      expect(() => sendMessageSchema.parse({ receiverId: '123e4567-e89b-12d3-a456-426614174000', content: 'x'.repeat(5001) })).toThrow();
    });

    it('rejects missing both receiverId and receiver_id', () => {
      expect(() => sendMessageSchema.parse({ content: 'Hello' })).toThrow();
    });

    it('transforms camelCase and defaults messageType to text', () => {
      const result = sendMessageSchema.parse({ receiverId: '123e4567-e89b-12d3-a456-426614174000', content: 'Hi' });
      expect(result.messageType).toBe('text');
    });

    it('accepts optional messageType', () => {
      const result = sendMessageSchema.parse({ receiverId: '123e4567-e89b-12d3-a456-426614174000', content: 'Hi', messageType: 'image' });
      expect(result.messageType).toBe('image');
    });

    it('rejects invalid messageType', () => {
      expect(() => sendMessageSchema.parse({ receiverId: '123e4567-e89b-12d3-a456-426614174000', content: 'Hi', messageType: 'invalid' })).toThrow();
    });

    it('rejects invalid UUID for receiverId', () => {
      expect(() => sendMessageSchema.parse({ receiverId: 'not-uuid', content: 'Hi' })).toThrow();
    });
  });

  describe('createChatRoomSchema', () => {
    it('validates correct room data', () => {
      const data = { name: 'Test Room', member_ids: ['123e4567-e89b-12d3-a456-426614174000'] };
      expect(() => createChatRoomSchema.parse(data)).not.toThrow();
    });

    it('rejects empty name', () => {
      expect(() => createChatRoomSchema.parse({ name: '', member_ids: ['id'] })).toThrow();
    });

    it('rejects name over 100 chars', () => {
      expect(() => createChatRoomSchema.parse({ name: 'x'.repeat(101), member_ids: ['id'] })).toThrow();
    });

    it('rejects empty members array', () => {
      expect(() => createChatRoomSchema.parse({ name: 'Room', member_ids: [] })).toThrow();
    });

    it('rejects more than 50 members', () => {
      const ids = Array.from({ length: 51 }, (_, i) => '123e4567-e89b-12d3-a456-4266141740' + String(i).padStart(2, '0'));
      expect(() => createChatRoomSchema.parse({ name: 'Room', member_ids: ids })).toThrow();
    });
  });
});

describe('Post Schemas', () => {
  describe('createPostBodySchema', () => {
    it('validates correct post data with passthrough', () => {
      const data = { content: 'Hello world', tags: ['test'], userName: 'Test' };
      const result = createPostBodySchema.parse(data);
      expect(result.content).toBe('Hello world');
      expect((result as any).userName).toBe('Test');
    });

    it('rejects empty content', () => {
      expect(() => createPostBodySchema.parse({ content: '' })).toThrow();
    });

    it('rejects content over 10000 chars', () => {
      expect(() => createPostBodySchema.parse({ content: 'x'.repeat(10001) })).toThrow();
    });
  });

  describe('addCommentBodySchema', () => {
    it('validates correct comment with passthrough', () => {
      const result = addCommentBodySchema.parse({ content: 'Great post!', userName: 'Test' });
      expect(result.content).toBe('Great post!');
      expect((result as any).userName).toBe('Test');
    });

    it('rejects empty comment', () => {
      expect(() => addCommentBodySchema.parse({ content: '' })).toThrow();
    });

    it('rejects comment over 10000 chars', () => {
      expect(() => addCommentBodySchema.parse({ content: 'x'.repeat(10001) })).toThrow();
    });
  });

  describe('votePostBodySchema', () => {
    it('accepts -1', () => {
      expect(() => votePostBodySchema.parse({ vote: -1 })).not.toThrow();
    });

    it('accepts 0', () => {
      expect(() => votePostBodySchema.parse({ vote: 0 })).not.toThrow();
    });

    it('accepts 1', () => {
      expect(() => votePostBodySchema.parse({ vote: 1 })).not.toThrow();
    });

    it('rejects 2', () => {
      expect(() => votePostBodySchema.parse({ vote: 2 })).toThrow();
    });

    it('rejects -2', () => {
      expect(() => votePostBodySchema.parse({ vote: -2 })).toThrow();
    });

    it('rejects non-integer', () => {
      expect(() => votePostBodySchema.parse({ vote: 0.5 })).toThrow();
    });
  });
});

describe('Tracker Schemas', () => {
  describe('trackerEntrySchema', () => {
    it('validates correct entry', () => {
      const data = { tracker_id: '123e4567-e89b-12d3-a456-426614174000', data: { reps: 10 } };
      expect(() => trackerEntrySchema.parse(data)).not.toThrow();
    });

    it('rejects empty data object', () => {
      expect(() => trackerEntrySchema.parse({ tracker_id: '123e4567-e89b-12d3-a456-426614174000', data: {} })).toThrow();
    });

    it('rejects invalid tracker_id', () => {
      expect(() => trackerEntrySchema.parse({ tracker_id: 'bad', data: { reps: 10 } })).toThrow();
    });
  });

  describe('trackerLogSchema', () => {
    it('validates correct log', () => {
      const data = { type: 'strength', data: { weight: 100 } };
      expect(() => trackerLogSchema.parse(data)).not.toThrow();
    });

    it('rejects empty type', () => {
      expect(() => trackerLogSchema.parse({ type: '', data: { weight: 100 } })).toThrow();
    });
  });

  describe('createTrackerSchema', () => {
    it('validates correct tracker creation', () => {
      const data = { type: 'strength', name: 'Bench Press' };
      expect(() => createTrackerSchema.parse(data)).not.toThrow();
    });

    it('rejects empty type', () => {
      expect(() => createTrackerSchema.parse({ type: '', name: 'Test' })).toThrow();
    });

    it('rejects empty name', () => {
      expect(() => createTrackerSchema.parse({ type: 'strength', name: '' })).toThrow();
    });
  });
});

describe('Admin Schemas', () => {
  describe('grantPointsBodySchema', () => {
    it('accepts delta', () => {
      expect(() => grantPointsBodySchema.parse({ delta: 100 })).not.toThrow();
    });

    it('accepts points', () => {
      expect(() => grantPointsBodySchema.parse({ points: 100 })).not.toThrow();
    });

    it('rejects neither delta nor points', () => {
      expect(() => grantPointsBodySchema.parse({})).toThrow();
    });

    it('rejects negative points', () => {
      expect(() => grantPointsBodySchema.parse({ points: -1 })).toThrow();
    });
  });

  describe('banUserBodySchema', () => {
    it('validates correct ban data', () => {
      expect(() => banUserBodySchema.parse({ reason: 'Spam' })).not.toThrow();
    });

    it('rejects reason over 500 chars', () => {
      expect(() => banUserBodySchema.parse({ reason: 'x'.repeat(501) })).toThrow();
    });
  });

  describe('togglePremiumBodySchema', () => {
    it('requires boolean isPremium', () => {
      expect(() => togglePremiumBodySchema.parse({ isPremium: true })).not.toThrow();
    });

    it('rejects non-boolean', () => {
      expect(() => togglePremiumBodySchema.parse({ isPremium: 'yes' })).toThrow();
    });
  });

  describe('promoteUserBodySchema', () => {
    it('accepts valid roles', () => {
      for (const role of ['user', 'moderator', 'admin', 'staff']) {
        expect(() => promoteUserBodySchema.parse({ role })).not.toThrow();
      }
    });

    it('rejects invalid role', () => {
      expect(() => promoteUserBodySchema.parse({ role: 'superadmin' })).toThrow();
    });
  });

  describe('createChallengeBodySchema', () => {
    it('validates correct challenge data', () => {
      const data = { title: '30 Days Fitness', start_date: '2026-05-01T00:00:00.000Z', end_date: '2026-05-31T00:00:00.000Z' };
      expect(() => createChallengeBodySchema.parse(data)).not.toThrow();
    });

    it('rejects empty title', () => {
      expect(() => createChallengeBodySchema.parse({ title: '', start_date: '2026-05-01T00:00:00.000Z', end_date: '2026-05-31T00:00:00.000Z' })).toThrow();
    });
  });
});
