import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, InternalServerError } from '../utils/appErrors';
import logger from '../utils/logger';

/**
 * Demo user profiles + goal trees seeded for beta testing.
 * Each user gets:
 *   - A Supabase auth account (email/password)
 *   - A profiles row (name, bio, avatar_url, is_demo=true, onboarding_completed=true)
 *   - A goal_trees row with 3 root nodes across 2–3 domains
 *
 * These accounts appear as real matches but cannot log in
 * (passwords are random UUIDs — that's intentional).
 */
const DEMO_USERS = [
  {
    email: 'sara.milano.demo@praxis.app',
    name: 'Sara Milano',
    bio: 'Software engineer building in public. Running my first marathon while investing in index funds. Open to accountability partners who are serious about compounding — both money and fitness.',
    avatarUrl: 'https://i.pravatar.cc/150?img=68',
    goals: [
      { id: 'sg1', domain: 'Career', name: 'Ship SaaS side project to €5k MRR', weight: 1.0, progress: 0.35, customDetails: 'Building an analytics tool for e-commerce stores' },
      { id: 'sg2', domain: 'Investing / Financial Growth', name: 'Reach €100k investment portfolio', weight: 0.9, progress: 0.52, customDetails: 'VWCE + global bond index. Monthly DCA €800' },
      { id: 'sg3', domain: 'Fitness', name: 'Run 10k in under 50 minutes', weight: 0.8, progress: 0.65, customDetails: 'Training 4x/week using Hal Higdon plan' },
    ],
  },
  {
    email: 'marco.chen.demo@praxis.app',
    name: 'Marco Chen',
    bio: 'PhD dropout turned ML engineer. Reading philosophy at night, building LLM tooling by day. Looking for people who think long-term about technology and human flourishing.',
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
    goals: [
      { id: 'mc1', domain: 'Career', name: 'Land senior ML engineer role at a top AI lab', weight: 1.0, progress: 0.45, customDetails: 'Currently preparing ML system design interviews' },
      { id: 'mc2', domain: 'Academics', name: 'Publish paper on mechanistic interpretability', weight: 0.9, progress: 0.28, customDetails: 'Collaborating with 2 researchers from DeepMind' },
      { id: 'mc3', domain: 'Philosophical Development', name: 'Read 24 philosophy books this year', weight: 0.7, progress: 0.58, customDetails: 'Currently on Parfit. Next: Derek Reasons and Persons' },
    ],
  },
  {
    email: 'lena.mueller.demo@praxis.app',
    name: 'Lena Müller',
    bio: 'Therapist-in-training and amateur triathlete. Passionate about the intersection of physical performance and mental resilience. Looking for people who take recovery as seriously as training.',
    avatarUrl: 'https://i.pravatar.cc/150?img=47',
    goals: [
      { id: 'lm1', domain: 'Fitness', name: 'Complete an Olympic-distance triathlon', weight: 1.0, progress: 0.70, customDetails: 'Swim 1.5k, bike 40k, run 10k. Event: July 2026 Munich' },
      { id: 'lm2', domain: 'Mental Health', name: 'Build consistent meditation practice (30 min/day)', weight: 0.85, progress: 0.60, customDetails: 'Using Insight Timer. Current streak: 47 days' },
      { id: 'lm3', domain: 'Friendship / Social Engagement', name: 'Host monthly dinner club with 6 close friends', weight: 0.6, progress: 0.50, customDetails: 'Rotate cooking duties. Goal: deepen friendships intentionally' },
    ],
  },
  {
    email: 'carlos.reyes.demo@praxis.app',
    name: 'Carlos Reyes',
    bio: 'Bootstrapped two companies, sold one. Now angel investing while building my third. Learning to paint on Sundays. Interested in connecting with founders and artists who think differently.',
    avatarUrl: 'https://i.pravatar.cc/150?img=33',
    goals: [
      { id: 'cr1', domain: 'Investing / Financial Growth', name: 'Deploy €250k into 10 early-stage startups', weight: 1.0, progress: 0.40, customDetails: 'Focus: B2B SaaS, AI tooling. 4 deals closed so far' },
      { id: 'cr2', domain: 'Career', name: 'Build Startup #3 to €1M ARR', weight: 0.9, progress: 0.15, customDetails: 'Vertical SaaS for independent logistics operators' },
      { id: 'cr3', domain: 'Culture / Hobbies / Creative Pursuits', name: 'Paint 12 canvases and exhibit one', weight: 0.5, progress: 0.25, customDetails: 'Oil on canvas, learning from YouTube + local instructor' },
    ],
  },
  {
    email: 'priya.sharma.demo@praxis.app',
    name: 'Priya Sharma',
    bio: 'Neuroscience postdoc by day, language learner by night (currently C1 Italian). Optimizing for career excellence and inner peace simultaneously. Looking for science-minded people who also care about well-being.',
    avatarUrl: 'https://i.pravatar.cc/150?img=54',
    goals: [
      { id: 'ps1', domain: 'Academics', name: 'Publish 3 papers in Nature Neuroscience journal', weight: 1.0, progress: 0.33, customDetails: 'One under review, two in prep. Focus: memory consolidation during sleep' },
      { id: 'ps2', domain: 'Career', name: 'Secure faculty position at research university', weight: 0.95, progress: 0.20, customDetails: 'Applications open Oct 2026. Building network now' },
      { id: 'ps3', domain: 'Mental Health', name: 'Achieve sustainable work-life balance without guilt', weight: 0.8, progress: 0.55, customDetails: 'Therapy weekly, no-laptop Sundays, 8h sleep target' },
    ],
  },
  {
    email: 'tom.hansen.demo@praxis.app',
    name: 'Tom Hansen',
    bio: 'Former pro cyclist now coaching. Exploring what it means to compete when the prize is personal growth, not podiums. Into stoicism, jazz, and cold water swimming.',
    avatarUrl: 'https://i.pravatar.cc/150?img=7',
    goals: [
      { id: 'th1', domain: 'Fitness', name: 'Cycle 10,000 km this year (coaching + personal rides)', weight: 1.0, progress: 0.48, customDetails: '4,800 km logged. Mixing road and gravel routes' },
      { id: 'th2', domain: 'Culture / Hobbies / Creative Pursuits', name: 'Learn jazz piano to intermediate level', weight: 0.7, progress: 0.30, customDetails: 'Lessons weekly, 30 min practice daily. Target: play Autumn Leaves' },
      { id: 'th3', domain: 'Friendship / Social Engagement', name: 'Build tight-knit local community of 10+ people', weight: 0.65, progress: 0.45, customDetails: 'Weekly rides, monthly dinners, shared reading list' },
    ],
  },
  {
    email: 'yuki.tanaka.demo@praxis.app',
    name: 'Yuki Tanaka',
    bio: 'Principal engineer at fintech scale-up. Deep into distributed systems and Stoic philosophy. Currently writing a book about engineering decision-making. Serious about long-term compounding in all areas of life.',
    avatarUrl: 'https://i.pravatar.cc/150?img=28',
    goals: [
      { id: 'yt1', domain: 'Career', name: 'Write and self-publish engineering decision-making book', weight: 1.0, progress: 0.38, customDetails: 'Chapter 5 of 12 complete. Target: launch before Q3 2026' },
      { id: 'yt2', domain: 'Philosophical Development', name: 'Implement Stoic daily practices for full year', weight: 0.85, progress: 0.72, customDetails: 'Morning journaling, evening review, memento mori meditation' },
      { id: 'yt3', domain: 'Academics', name: 'Complete MIT OpenCourseWare distributed systems curriculum', weight: 0.75, progress: 0.55, customDetails: '6.824 lectures + all labs. Currently on Raft consensus' },
    ],
  },
];

/**
 * POST /admin/seed-demo-users
 *
 * Seeds 7 realistic demo user profiles into Supabase for beta testing.
 * These accounts appear as real matches for new users who haven't yet
 * accumulated organic matches, making the product feel social and alive
 * from day one.
 *
 * Security: requires X-Admin-Secret header matching ADMIN_SECRET env var.
 * Idempotent: skips users that already exist.
 */
export const seedDemoUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    throw new UnauthorizedError('Invalid or missing admin secret.');
  }

  const results: { name: string; status: 'created' | 'skipped'; userId?: string }[] = [];

  for (const demo of DEMO_USERS) {
    // Check if this demo user already exists in profiles by looking for their email
    // We use auth.admin to look up auth users
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      logger.error('Failed to list users during demo seed:', listError.message);
      continue;
    }

    const existingUser = existingUsers.users.find(u => u.email === demo.email);

    if (existingUser) {
      results.push({ name: demo.name, status: 'skipped', userId: existingUser.id });
      continue;
    }

    // Create auth user with a random password (demo accounts cannot be logged into)
    const password = `demo-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: demo.email,
      password,
      email_confirm: true,
      user_metadata: { name: demo.name },
    });

    if (authError || !authData.user) {
      logger.error(`Failed to create auth user for ${demo.name}:`, authError?.message);
      continue;
    }

    const userId = authData.user.id;

    // Update the auto-created profile row (created by the handle_new_user trigger)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: demo.name,
        bio: demo.bio,
        avatar_url: demo.avatarUrl,
        onboarding_completed: true,
        is_demo: true,
        is_premium: false,
      })
      .eq('id', userId);

    if (profileError) {
      logger.error(`Failed to update profile for ${demo.name}:`, profileError.message);
    }

    // Insert goal tree — each goal maps to a GoalNode in the goal_trees table
    const { error: goalsError } = await supabase
      .from('goal_trees')
      .insert({
        userId,
        nodes: demo.goals,
        rootNodes: demo.goals, // All are root nodes for demo users
      });

    if (goalsError) {
      logger.error(`Failed to insert goals for ${demo.name}:`, goalsError.message);
    }

    results.push({ name: demo.name, status: 'created', userId });
    logger.info(`Seeded demo user: ${demo.name} (${userId})`);
  }

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  res.json({
    message: `Demo seed complete. ${created} created, ${skipped} skipped.`,
    results,
  });
});

/**
 * DELETE /admin/delete-demo-users
 *
 * Removes all demo users (is_demo = true) from Supabase Auth and the profiles table.
 * Cascade deletes handle goal_trees and other related rows automatically.
 *
 * Security: requires X-Admin-Secret header matching ADMIN_SECRET env var.
 */
export const deleteDemoUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    throw new UnauthorizedError('Invalid or missing admin secret.');
  }

  // Fetch all demo profile IDs
  const { data: demoProfiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_demo', true);

  if (fetchError) {
    throw new Error(`Failed to fetch demo profiles: ${fetchError.message}`);
  }

  if (!demoProfiles || demoProfiles.length === 0) {
    return res.json({ message: 'No demo users found.', deleted: 0 });
  }

  const results: { id: string; status: 'deleted' | 'error'; error?: string }[] = [];

  for (const profile of demoProfiles) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id);
    if (deleteError) {
      logger.error(`Failed to delete demo user ${profile.id}:`, deleteError.message);
      results.push({ id: profile.id, status: 'error', error: deleteError.message });
    } else {
      results.push({ id: profile.id, status: 'deleted' });
      logger.info(`Deleted demo user: ${profile.id}`);
    }
  }

  const deleted = results.filter(r => r.status === 'deleted').length;
  const failed = results.filter(r => r.status === 'error').length;

  res.json({
    message: `Demo cleanup complete. ${deleted} deleted, ${failed} failed.`,
    results,
  });
});

// ─── JWT-protected admin endpoints (called from the webapp) ──────────────────

/**
 * GET /admin/users
 * Returns all users merged from auth + profiles.
 */
export const listAllUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) throw new InternalServerError('Failed to fetch auth users.');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, bio, avatar_url, is_demo, is_admin, is_premium, onboarding_completed, created_at');

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  const merged = authData.users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    ...profileMap.get(u.id),
  }));

  res.json(merged);
});

/**
 * DELETE /admin/users/:id
 * Hard-deletes any user from Supabase Auth (cascades to profiles + all data).
 */
export const adminDeleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  const adminId = req.user?.id;
  if (id === adminId) throw new BadRequestError('Cannot delete your own admin account.');

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new InternalServerError(`Failed to delete user: ${error.message}`);

  logger.info(`Admin ${adminId} deleted user ${id}`);
  res.json({ message: 'User deleted.' });
});

/**
 * DELETE /admin/posts/:id
 * Deletes any post regardless of ownership.
 */
export const adminDeletePost = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw new InternalServerError('Failed to delete post.');

  logger.info(`Admin ${req.user?.id} deleted post ${id}`);
  res.json({ message: 'Post deleted.' });
});

/**
 * DELETE /admin/groups/:id
 * Deletes any group room and all its members/messages.
 */
export const adminDeleteGroup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  const { error } = await supabase.from('chat_rooms').delete().eq('id', id);
  if (error) throw new InternalServerError('Failed to delete group.');

  logger.info(`Admin ${req.user?.id} deleted group ${id}`);
  res.json({ message: 'Group deleted.' });
});
