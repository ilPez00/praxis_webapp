import { MaslowDomain, MaslowLevel } from '../types/MaslowDomain';
import { Domain } from '../types/goal';

export function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    name: 'Test User',
    bio: 'A test user bio',
    city: 'Test City',
    avatar_url: null,
    praxis_points: 100,
    streak: 5,
    reliability_score: 0.85,
    is_premium: false,
    is_admin: false,
    onboarding_completed: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildGoalNode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'node-001',
    domain: Domain.FITNESS,
    name: 'Test Goal',
    weight: 1.0,
    progress: 0.5,
    category: undefined,
    customDetails: undefined,
    parentId: undefined,
    prerequisiteGoalIds: undefined,
    ...overrides,
  };
}

export function buildCheckIn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'checkin-001',
    user_id: '00000000-0000-0000-0000-000000000001',
    mood: 7,
    notes: 'Had a good day',
    tags: ['fitness', 'work'],
    created_at: '2026-04-27T00:00:00.000Z',
    ...overrides,
  };
}

export function buildMaslowDomainConfig(overrides: Record<string, unknown> = {}) {
  return {
    value: MaslowDomain.BODY_FITNESS,
    label: '💪 Body & Fitness',
    color: '#EF4444',
    icon: '💪',
    level: MaslowLevel.LEVEL_1_PHYSIOLOGICAL,
    levelName: 'Physiological',
    ...overrides,
  };
}

export function buildLoggingSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test_1',
    text: 'What did you accomplish today?',
    category: 'reflection' as const,
    priority: 10,
    ...overrides,
  };
}
