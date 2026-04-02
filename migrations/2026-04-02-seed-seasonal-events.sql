-- Seed data for April Accountability Challenge (2026)
-- Run this after the main migration

INSERT INTO seasonal_events (
  slug,
  name,
  description,
  theme_color,
  icon,
  event_type,
  starts_at,
  ends_at,
  target_value,
  target_metric,
  reward_pp,
  reward_xp,
  reward_badge,
  is_active
) VALUES (
  'april-accountability-2026',
  'April Accountability Challenge',
  'Check in every day during April to prove your discipline. Build a 30-day streak and earn exclusive rewards!',
  '#22C55E',
  '🌱',
  'streak_challenge',
  '2026-04-01T00:00:00Z',
  '2026-04-30T23:59:59Z',
  30,
  'streak_days',
  500,
  200,
  'April Sprout 🌱',
  true
);

-- Summer Streak Challenge (starts June 1)
INSERT INTO seasonal_events (
  slug,
  name,
  description,
  theme_color,
  icon,
  event_type,
  starts_at,
  ends_at,
  target_value,
  target_metric,
  reward_pp,
  reward_xp,
  reward_badge,
  is_active
) VALUES (
  'summer-streak-2026',
  'Summer Streak Challenge',
  'Keep your streak alive through the summer months. 60 days of consistency builds unshakeable habits.',
  '#F59E0B',
  '☀️',
  'streak_challenge',
  '2026-06-01T00:00:00Z',
  '2026-08-31T23:59:59Z',
  60,
  'streak_days',
  1000,
  500,
  'Summer Champion ☀️',
  true
);
