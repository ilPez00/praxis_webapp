import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, InternalServerError } from '../utils/appErrors';
import logger from '../utils/logger';
import { importOSMPlaces } from '../services/OSMImportService';

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
  const isSecretAuth = adminSecret && req.headers['x-admin-secret'] === adminSecret;
  // When called via JWT-secured route (/admin/seed), req.user is set by authenticateToken + requireAdmin
  const isJwtAdmin = !!(req as any).user?.id;
  if (!isSecretAuth && !isJwtAdmin) {
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
        user_id: userId,
        nodes: demo.goals,
        root_nodes: demo.goals.map((g: any) => g.id), // All are root nodes for demo users
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
  const isSecretAuth = adminSecret && req.headers['x-admin-secret'] === adminSecret;
  const isJwtAdmin = !!(req as any).user?.id;
  if (!isSecretAuth && !isJwtAdmin) {
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
    .select('id, name, bio, avatar_url, is_demo, is_admin, is_premium, onboarding_completed, role, honor_score, praxis_points, current_streak, reliability_score, goal_tree_edit_count, created_at');

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
 * 
 * Query params:
 * - reset_only=true: Delete all data but keep auth account (forces re-onboarding)
 * - hard_delete=true: Delete everything including auth account (default for non-demo)
 */
export const adminDeleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  const adminId = req.user?.id;
  const resetOnly = req.query.reset_only === 'true';
  const hardDelete = req.query.hard_delete === 'true';
  
  if (id === adminId) throw new BadRequestError('Cannot delete your own admin account.');

  logger.info(`Admin ${adminId} attempting to ${resetOnly ? 'reset' : 'delete'} user ${id}`);

  // Get user info before deletion
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_demo, email')
    .eq('id', id)
    .single();

  const isDemo = profile?.is_demo || false;

  // RESET ONLY MODE - Keep auth account, delete all data, reset onboarding
  if (resetOnly) {
    logger.info(`Resetting user ${id} to pre-onboarding state`);
    
    // Delete all user data from all tables (order matters for FK constraints)
    const tablesToDelete = [
      // Dependencies first
      'notebook_entries', 'notebook_tags',
      'axiom_daily_briefs', 'axiom_schedules', 'schedule_time_slots', 'schedule_completions',
      'journal_entries', 'node_journal_entries', 
      'tracker_entries', 'trackers',
      'post_votes', 'post_comments', 'post_likes', 'posts',
      'checkins',
      'goal_progress_history', 'goal_trees',
      'achievements', 'achievement_comments', 'achievement_votes',
      'chat_messages', 'chat_room_members',
      'bets', 'wagers', 'duels',
      'notifications',
      'messages',
      'matches',
      'user_subscriptions', // Remove premium status
      'feedback',
      'referrals',
      'group_members',
      'event_members',
      'place_members',
      'diary_entries',
      // Keep profiles but reset it
    ];

    for (const table of tablesToDelete) {
      try {
        const { error } = await supabase.from(table).delete().eq('user_id', id);
        if (error) {
          logger.warn(`Failed to delete from ${table} for user ${id}: ${error.message}`);
        } else {
          logger.info(`Deleted from ${table} for user ${id}`);
        }
      } catch (err: any) {
        logger.warn(`Error deleting from ${table} for user ${id}: ${err.message}`);
      }
    }

    // Reset profiles table
    const { error: resetError } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: false,
        bio: null,
        avatar_url: null,
        praxis_points: 0,
        honor_score: 0,
        karma_score: 0,
        reliability_score: null,
        status_tier: 'Newcomer',
        streak_days: 0,
        total_checkins: 0,
        last_checkin_at: null,
        minimal_ai_mode: false,
        is_premium: false,
      })
      .eq('id', id);

    if (resetError) {
      logger.error(`Failed to reset profile for user ${id}: ${resetError.message}`);
      throw new InternalServerError('Failed to reset user profile');
    }

    logger.info(`Successfully reset user ${id} to pre-onboarding state`);
    return res.json({ 
      message: 'User reset successfully. They must complete onboarding again.',
      reset: true,
    });
  }

  // HARD DELETE MODE - Delete everything including auth account
  logger.info(`Hard deleting user ${id} (including auth account)`);
  
  // First delete from auth (this should cascade to profiles and all related data)
  const { error: authError } = await supabase.auth.admin.deleteUser(id);

  if (authError) {
    logger.error(`Auth delete failed for user ${id}: ${authError.message}`);

    // If auth delete fails, try manual cascade delete
    // This handles cases where user might not exist in auth but has orphaned data
    const tables = [
      'notebook_entries', 'notebook_tags', 'axiom_daily_briefs', 'axiom_schedules',
      'schedule_time_slots', 'schedule_completions',
      'journal_entries', 'node_journal_entries', 'tracker_entries',
      'trackers', 'posts', 'checkins', 'goal_trees', 'achievements',
      'achievement_comments', 'achievement_votes', 'chat_messages',
      'chat_room_members', 'bets', 'wagers', 'duels', 'notifications',
      'messages', 'matches', 'user_subscriptions', 'feedback',
      'referrals', 'group_members', 'event_members', 'place_members',
      'diary_entries', 'profiles'
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).delete().eq('user_id', id);
        if (!error) {
          logger.info(`Deleted from ${table} for user ${id}`);
        }
      } catch (err: any) {
        logger.warn(`Failed to delete from ${table} for user ${id}: ${err.message}`);
      }
    }

    return res.json({ 
      message: 'User data cleaned up (auth delete failed, manual cleanup performed).',
      hard_delete: false,
    });
  }

  logger.info(`Admin ${adminId} successfully deleted user ${id} from auth`);
  res.json({ 
    message: 'User deleted permanently.',
    hard_delete: true,
  });
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

/**
 * POST /admin/users/:id/ban
 * Bans a user for 100 years (effectively permanent). They cannot log in until unbanned.
 */
export const banUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  if (id === req.user?.id) throw new BadRequestError('Cannot ban yourself.');

  const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' });
  if (error) throw new InternalServerError(`Failed to ban user: ${error.message}`);

  logger.info(`Admin ${req.user?.id} banned user ${id}`);
  res.json({ message: 'User banned.' });
});

/**
 * POST /admin/users/:id/unban
 * Lifts the ban on a user.
 */
export const unbanUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);

  const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: 'none' });
  if (error) throw new InternalServerError(`Failed to unban user: ${error.message}`);

  logger.info(`Admin ${req.user?.id} unbanned user ${id}`);
  res.json({ message: 'User unbanned.' });
});

/**
 * POST /admin/users/:id/grant-points
 * Adjusts a user's praxis_points by a delta (positive or negative).
 * Body: { delta: number } — e.g. { delta: 500 } or { delta: -200 }
 * Or just send points directly: { points: number } — e.g. { points: 1000 }
 */
export const grantPoints = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const id = String(req.params.id);
  
  // Accept either delta or direct points value
  let delta: number;
  if (typeof req.body?.delta === 'number') {
    delta = Math.round(req.body.delta);
  } else if (typeof req.body?.points === 'number') {
    // If points is provided, calculate delta from current
    const { data: profile } = await supabase
      .from('profiles')
      .select('praxis_points')
      .eq('id', id)
      .single();
    const current = profile?.praxis_points ?? 0;
    delta = Math.round(req.body.points) - current;
  } else {
    // Default to +1000 if nothing specified
    delta = 1000;
  }

  logger.info(`Admin ${req.user?.id} attempting to grant points to user ${id}: delta=${delta}`);

  // Fetch current points first
  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', id)
    .single();

  if (fetchErr || !profile) {
    logger.error(`Failed to fetch user ${id} profile: ${fetchErr?.message || 'User not found'}`);
    throw new InternalServerError('User not found.');
  }

  const current: number = profile.praxis_points ?? 0;
  const newPoints = Math.max(0, current + delta);

  const { error } = await supabase
    .from('profiles')
    .update({ praxis_points: newPoints })
    .eq('id', id);

  if (error) {
    logger.error(`Failed to update points for user ${id}: ${error.message}`);
    throw new InternalServerError(`Failed to update points: ${error.message}`);
  }

  logger.info(`Admin ${req.user?.id} adjusted points for user ${id}: ${current} → ${newPoints} (delta ${delta})`);
  res.json({ message: `Points updated: ${current} → ${newPoints}.`, points: newPoints, delta });
});

/**
 * POST /admin/users/grant-points-all
 * Adjusts ALL users' praxis_points by a delta.
 * Body: { delta: number }
 */
export const grantPointsToAll = catchAsync(async (req: Request, res: Response) => {
  const delta = Math.round(Number(req.body?.delta || 0));
  if (!delta) throw new BadRequestError('delta is required and must be non-zero.');

  const adminId = req.user?.id;
  logger.info(`Admin ${adminId} granting ${delta} PP to ALL users`);

  // We can't do a relative update like "SET praxis_points = praxis_points + delta" 
  // in a single Supabase query easily for ALL rows.
  // We'll fetch them and update them in batches or use a direct SQL if possible.
  // Since we are in an admin context, we'll do it safely.
  
  const { data: profiles, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, praxis_points');

  if (fetchErr) throw new InternalServerError('Failed to fetch profiles.');

  // We can use RPC for efficiency or manual batching. 
  // For simplicity here, we'll use profile count and do it.
  
  let updated = 0;
  for (const p of (profiles || [])) {
    const current = p.praxis_points ?? 0;
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ praxis_points: Math.max(0, current + delta) })
      .eq('id', p.id);
    
    if (!updateErr) updated++;
  }

  res.json({ success: true, message: `Points granted to ${updated} users.`, delta });
});

/**
 * POST /admin/config/clear-seen-messages
 * Resets last_seen_message_id for all users so they see the current global message.
 */
export const clearSeenMessages = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user?.id;
  logger.info(`Admin ${adminId} clearing seen message status for all users`);

  const { error } = await supabase
    .from('profiles')
    .update({ last_seen_message_id: null });

  if (error) throw new InternalServerError('Failed to clear seen messages.');

  res.json({ success: true, message: 'All users will see the current global message on next login.' });
});

/**
 * POST /admin/users/:id/reset-tree-edits
 * Resets goal_tree_edit_count to 0, giving the user a free goal tree re-edit.
 */
export const resetTreeEdits = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const id = String(req.params.id);

  const { error } = await supabase
    .from('profiles')
    .update({ goal_tree_edit_count: 0 })
    .eq('id', id);

  if (error) throw new InternalServerError(`Failed to reset tree edits: ${error.message}`);

  logger.info(`Admin ${req.user?.id} reset goal_tree_edit_count for user ${id}`);
  res.json({ message: 'Goal tree edit count reset to 0.' });
});

/**
 * GET /admin/users/:id/detail
 * Returns all profile fields + aggregate counts for a user.
 */
export const getUserDetail = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const id = String(req.params.id);

  const [profileRes, checkinRes, postRes, treeRes, friendRes, completionRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('goal_trees').select('user_id, nodes, root_nodes').eq('user_id', id).maybeSingle(),
    supabase.from('friendships').select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${id},recipient_id.eq.${id}`).eq('status', 'accepted'),
    supabase.from('completion_requests').select('id, status', { count: 'exact' }).eq('verifier_id', id),
  ]);

  if (!profileRes.data) throw new InternalServerError('User not found.');

  const profile = profileRes.data;
  const tree = treeRes.data as any;
  const rootNodeCount = Array.isArray(tree?.root_nodes) ? tree.root_nodes.length : 0;
  const totalNodeCount = Array.isArray(tree?.nodes) ? tree.nodes.length : 0;

  res.json({
    ...profile,
    checkin_count: checkinRes.count ?? 0,
    post_count: postRes.count ?? 0,
    friend_count: friendRes.count ?? 0,
    root_goal_count: rootNodeCount,
    total_node_count: totalNodeCount,
    verification_count: completionRes.count ?? 0,
  });
});

/**
 * GET /admin/groups
 * Lists all chat rooms and boards for moderation.
 */
export const listGroups = catchAsync(async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('id, name, description, created_at, is_board')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch groups.' });
  return res.json(data ?? []);
});

/**
 * GET /admin/stats
 * Aggregate stats for the whole userbase.
 */
export const getAdminStats = catchAsync(async (_req: Request, res: Response) => {
  const [usersRes, treesRes, profilesRes, checkinsRes, challengesRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('goal_trees').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('praxis_points, current_streak, is_premium'),
    supabase.from('checkins').select('id', { count: 'exact', head: true })
      .gte('checked_in_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    supabase.from('challenges').select('id', { count: 'exact', head: true }),
  ]);

  const profiles = profilesRes.data ?? [];
  const totalPoints = profiles.reduce((s, p) => s + (p.praxis_points ?? 0), 0);
  const avgStreak = profiles.length > 0
    ? Math.round(profiles.reduce((s, p) => s + (p.current_streak ?? 0), 0) / profiles.length)
    : 0;
  const premiumCount = profiles.filter(p => p.is_premium).length;

  return res.json({
    totalUsers: usersRes.count ?? 0,
    totalGoalTrees: treesRes.count ?? 0,
    totalPoints,
    avgStreak,
    premiumCount,
    activeToday: checkinsRes.count ?? 0,
    totalChallenges: challengesRes.count ?? 0,
  });
});

/**
 * GET /admin/network
 * Returns users + their goal domains for the network diagram.
 */
export const getNetworkData = catchAsync(async (_req: Request, res: Response) => {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, praxis_points, current_streak');

  const { data: trees } = await supabase
    .from('goal_trees')
    .select('user_id, nodes');

    const domainsByUser: Record<string, string[]> = {};
    for (const tree of trees ?? []) {
    const uid = (tree as any).user_id;

    const nodes: any[] = Array.isArray((tree as any).nodes) ? (tree as any).nodes : [];
    domainsByUser[uid] = [...new Set(nodes.map((n: any) => n.domain).filter(Boolean))];
  }

  const nodes = (profiles ?? []).map(p => ({
    id: p.id,
    name: p.name,
    points: p.praxis_points ?? 0,
    streak: p.current_streak ?? 0,
    domains: domainsByUser[p.id] ?? [],
  }));

  // Edges: users sharing ≥1 domain
  const edges: { source: string; target: string; sharedDomains: string[] }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = new Set(nodes[i].domains);
      const shared = nodes[j].domains.filter((d: string) => a.has(d));
      if (shared.length > 0) {
        edges.push({ source: nodes[i].id, target: nodes[j].id, sharedDomains: shared });
      }
    }
  }

  return res.json({ nodes, edges });
});

/**
 * GET /admin/challenges
 * List all community challenges.
 */
export const listChallenges = catchAsync(async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, title, description, domain, duration_days, reward_points, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch challenges.' });
  return res.json(data ?? []);
});

/**
 * POST /admin/challenges
 * Create a community challenge with optional reward_points.
 */
export const createChallenge = catchAsync(async (req: Request, res: Response) => {
  const { title, description, domain, duration_days, reward_points } = req.body as {
    title: string; description?: string; domain: string;
    duration_days?: number; reward_points?: number;
  };
  if (!title || !domain) throw new BadRequestError('title and domain are required.');

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      title,
      description: description ?? null,
      domain,
      duration_days: duration_days ?? 30,
      reward_points: reward_points ?? 100,
    })
    .select()
    .single();

  if (error) throw new InternalServerError(`Failed to create challenge: ${error.message}`);
  logger.info(`Admin ${req.user?.id} created challenge "${title}"`);
  return res.json(data);
});

/**
 * GET /admin/services
 * Lists all services/jobs/gigs for admin moderation.
 */
export const listAllServices = catchAsync(async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('services')
    .select('id, user_id, user_name, user_avatar_url, title, type, domain, price, price_currency, active, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found') || error.code === '42P01') {
      return res.json([]);
    }
    return res.status(500).json({ error: 'Failed to fetch services.' });
  }
  return res.json(data ?? []);
});

/**
 * DELETE /admin/services/:id
 * Admin-deletes any service listing.
 */
export const adminDeleteService = catchAsync(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw new InternalServerError('Failed to delete service.');
  logger.info(`Admin ${req.user?.id} deleted service ${id}`);
  res.json({ message: 'Service deleted.' });
});

/**
 * GET /admin/coaches
 * Lists all coach profiles for admin review.
 */
export const listAllCoaches = catchAsync(async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('id, user_id, bio, domains, skills, rating, hourly_rate, is_available, created_at')
    .order('rating', { ascending: false });
  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found') || error.code === '42P01') {
      return res.json([]);
    }
    return res.status(500).json({ error: 'Failed to fetch coaches.' });
  }
  return res.json(data ?? []);
});

/**
 * POST /admin/decay-points
 * Weekly economy balancer — run via cron (e.g. Railway scheduled job every Sunday).
 *
 * Rules applied in order:
 *   1. Inactivity decay  — users with no activity in ≥7 days lose 5% of their PP
 *   2. Wealth tax        — users with PP > WEALTH_TAX_THRESHOLD lose an additional 2%
 *
 * Both are floored at 0 and rounded down.
 * Returns a report of how many users were affected and total PP removed.
 *
 * Safe to call via X-Admin-Secret header (cron) or JWT admin auth (webapp).
 */
export const decayPoints = catchAsync(async (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const isSecretAuth = adminSecret && req.headers['x-admin-secret'] === adminSecret;
  const isJwtAdmin = !!(req as any).user?.id;
  if (!isSecretAuth && !isJwtAdmin) {
    throw new UnauthorizedError('Admin authentication required.');
  }

  const INACTIVITY_DECAY_RATE = 0.05;   // -5% for inactive users
  const WEALTH_TAX_RATE       = 0.02;   // -2% additional for high-balance users
  const WEALTH_TAX_THRESHOLD  = 5000;   // PP above this get the wealth tax
  const INACTIVITY_DAYS       = 7;      // days without activity = inactive

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INACTIVITY_DAYS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  // Fetch all profiles with any PP
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, praxis_points, last_activity_date')
    .gt('praxis_points', 0);

  if (error) throw new InternalServerError('Failed to fetch profiles for decay.');

  let inactiveDecayed = 0;
  let wealthTaxed = 0;
  let totalPPRemoved = 0;
  const updates: { id: string; newPoints: number; removed: number; reasons: string[] }[] = [];

  for (const profile of profiles ?? []) {
    const current: number = profile.praxis_points ?? 0;
    if (current <= 0) continue;

    let adjusted = current;
    const reasons: string[] = [];

    // Rule 1: inactivity decay (no activity in ≥ INACTIVITY_DAYS days, or never active)
    const lastActive = profile.last_activity_date;
    const isInactive = !lastActive || lastActive < cutoffStr;
    if (isInactive) {
      const decayAmount = Math.floor(adjusted * INACTIVITY_DECAY_RATE);
      adjusted = Math.max(0, adjusted - decayAmount);
      reasons.push(`inactivity -${decayAmount}`);
      inactiveDecayed++;
    }

    // Rule 2: wealth tax (applied to anyone above threshold, after inactivity decay)
    if (adjusted > WEALTH_TAX_THRESHOLD) {
      const taxAmount = Math.floor(adjusted * WEALTH_TAX_RATE);
      adjusted = Math.max(0, adjusted - taxAmount);
      reasons.push(`wealth_tax -${taxAmount}`);
      wealthTaxed++;
    }

    if (adjusted < current) {
      updates.push({ id: profile.id, newPoints: adjusted, removed: current - adjusted, reasons });
      totalPPRemoved += current - adjusted;
    }
  }

  // Apply all updates (batch by updating one at a time — Supabase JS doesn't support bulk UPDATE)
  let applied = 0;
  for (const u of updates) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ praxis_points: u.newPoints })
      .eq('id', u.id);
    if (!updateError) applied++;
    else logger.warn(`Decay update failed for ${u.id}: ${updateError.message}`);
  }

  const report = {
    ran_at: new Date().toISOString(),
    inactivity_cutoff: cutoffStr,
    profiles_scanned: (profiles ?? []).length,
    inactivity_decayed: inactiveDecayed,
    wealth_taxed: wealthTaxed,
    updates_applied: applied,
    total_pp_removed: totalPPRemoved,
  };

  logger.info(`[Decay] ${applied} profiles updated, ${totalPPRemoved} PP removed`, report);
  return res.json(report);
});

/**
 * PUT /admin/users/:id/role
 * Promote or demote a user's role. Roles: user | staff | moderator | admin
 */
export const promoteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['user', 'staff', 'moderator', 'admin'];
  if (!validRoles.includes(role)) throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);

  const adminId = req.user?.id;
  if (id === adminId && role !== 'admin') {
    throw new BadRequestError('Cannot demote your own admin account.');
  }

  const updateData: Record<string, unknown> = { role };
  // Keep is_admin in sync with role column for backwards compatibility
  if (role === 'admin') updateData.is_admin = true;
  else updateData.is_admin = false;

  const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
  if (error) throw new InternalServerError(`Failed to update role: ${error.message}`);

  logger.info(`Admin ${adminId} set role=${role} for user ${id}`);
  res.json({ success: true, role });
});

/**
 * PUT /admin/users/:id/premium
 * Toggle a user's is_premium status.
 */
export const togglePremium = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_premium } = req.body;

  if (typeof is_premium !== 'boolean') throw new BadRequestError('is_premium must be a boolean.');

  const { error } = await supabase.from('profiles').update({ is_premium }).eq('id', id);
  if (error) throw new InternalServerError(`Failed to update premium status: ${error.message}`);

  logger.info(`Admin ${req.user?.id} set is_premium=${is_premium} for user ${id}`);
  res.json({ success: true, is_premium });
});

/**
 * POST /admin/cron/leaderboard-bonus
 * Daily leaderboard bonus: #1 +500 PP, top 10 +200 PP, top 100 +50 PP.
 * Security: X-Admin-Secret header (for cron service) or JWT admin.
 */
export const leaderboardBonus = catchAsync(async (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const isSecretAuth = adminSecret && req.headers['x-admin-secret'] === adminSecret;
  const isJwtAdmin = !!(req as any).user?.id;
  if (!isSecretAuth && !isJwtAdmin) throw new UnauthorizedError('Admin authentication required.');

  // Fetch top 100 by praxis_points
  const { data: top, error } = await supabase
    .from('profiles')
    .select('id, praxis_points')
    .order('praxis_points', { ascending: false })
    .limit(100);

  if (error) throw new InternalServerError('Failed to fetch leaderboard.');

  const awarded: { id: string; rank: number; bonus: number }[] = [];

  for (let i = 0; i < (top ?? []).length; i++) {
    const profile = top![i];
    let bonus = 50; // top 100
    if (i === 0) bonus = 500;      // #1
    else if (i < 10) bonus = 200;  // top 10

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ praxis_points: (profile.praxis_points ?? 0) + bonus })
      .eq('id', profile.id);

    if (!updateError) awarded.push({ id: profile.id, rank: i + 1, bonus });
    else logger.warn(`Leaderboard bonus failed for rank ${i + 1}: ${updateError.message}`);
  }

  const report = {
    ran_at: new Date().toISOString(),
    awarded_count: awarded.length,
    breakdown: { first: 500, top10: 200, top100: 50 },
    recipients: awarded,
  };
  logger.info(`[LeaderboardBonus] Awarded PP to ${awarded.length} users`);
  return res.json(report);
});

import { AxiomScanService } from '../services/AxiomScanService';

/**
 * GET /admin/config
 */
export const getSystemConfig = catchAsync(async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from('system_config').select('*');
  if (error) throw new InternalServerError('Failed to fetch config.');
  res.json(data || []);
});

/**
 * PUT /admin/config/:key
 */
export const updateSystemConfig = catchAsync(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  const userId = req.user?.id;

  const { data, error } = await supabase
    .from('system_config')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: userId }, { onConflict: 'key' })
    .select()
    .single();

  if (error) throw new InternalServerError('Failed to update config.');
  res.json(data);
});

/**
 * POST /admin/axiom/trigger-scan
 * Triggers midnight scan that generates detailed LLM-powered Axiom daily briefs for ALL active users
 */
export const triggerAxiomScan = catchAsync(async (_req: Request, res: Response) => {
  logger.info('[Admin] Manual Axiom scan triggered by admin');
  
  // Run in background and track progress
  const scanPromise = AxiomScanService.runGlobalScan()
    .then(() => {
      logger.info('[Admin] Manual Axiom scan completed successfully');
    })
    .catch(err => {
      logger.error('[Admin] Manual Axiom scan background failure:', err.message);
    });

  // Don't wait for completion, but track it
  scanPromise.catch(err => logger.warn('Fire-and-forget failed:', err?.message));

  res.json({ 
    message: 'Global Axiom scan triggered in background. LLM-powered briefs will be generated for all active users.',
    status: 'running',
    note: 'Check server logs for progress. Briefs will appear in users axiom_daily_briefs table.'
  });
});

/**
 * POST /admin/axiom/generate-all-briefs
 * Synchronously generates LLM-powered briefs for ALL active users (waits for completion)
 * Use for testing or immediate deployment
 */
export const generateAllBriefs = catchAsync(async (_req: Request, res: Response) => {
  logger.info('[Admin] Manual Axiom brief generation started (synchronous)');
  
  const today = new Date().toISOString().slice(0, 10);
  const startTime = Date.now();
  
  // Get ALL active users
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, name, city, is_premium, is_admin, minimal_ai_mode, last_activity_date');

  if (userError) throw userError;
  if (!users || users.length === 0) {
    return res.json({ message: 'No active users found', generated: 0 });
  }

  // Filter to active users (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const activeUsers = users.filter(u => 
    !u.last_activity_date || new Date(u.last_activity_date) >= thirtyDaysAgo
  );

  logger.info(`[Admin] Generating briefs for ${activeUsers.length} active users`);

  let successCount = 0;
  let llmCount = 0;
  let algorithmCount = 0;
  let failCount = 0;

  // Process users in batches of 3 to avoid rate limiting
  const BATCH_SIZE = 3;
  for (let i = 0; i < activeUsers.length; i += BATCH_SIZE) {
    const batch = activeUsers.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.allSettled(batch.map(async user => {
      try {
        // Force LLM usage for all users
        await AxiomScanService.generateDailyBrief(
          user.id, 
          user.name || 'Student', 
          user.city || 'Unknown', 
          true // force LLM
        );
        
        // Check if LLM was successful
        const { data: brief } = await supabase
          .from('axiom_daily_briefs')
          .select('brief')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();
        
        const source = brief?.brief?.source || 'unknown';
        if (source === 'llm') {
          llmCount++;
        } else {
          algorithmCount++;
        }
        
        successCount++;
        logger.info(`[Admin] Brief generated for ${user.name || user.id} (source: ${source})`);
      } catch (err: any) {
        failCount++;
        logger.error(`[Admin] Failed for ${user.name || user.id}: ${err.message}`);
      }
    }));
    
    // Small pause between batches
    if (i + BATCH_SIZE < activeUsers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  logger.info(`[Admin] Brief generation complete: ${successCount} succeeded, ${failCount} failed in ${duration}s`);
  logger.info(`[Admin] LLM briefs: ${llmCount}, Algorithm briefs: ${algorithmCount}`);

  res.json({
    message: `Generated ${successCount} briefs in ${duration}s`,
    total_users: activeUsers.length,
    generated: successCount,
    failed: failCount,
    llm_briefs: llmCount,
    algorithm_briefs: algorithmCount,
    duration_seconds: duration,
  });
});

/**
 * POST /admin/cron/streak-alerts
 * Sends a push notification to every user who has a streak > 0 but hasn't
 * checked in today. Intended to run nightly around 20:00 UTC.
 * Security: X-Admin-Secret header or JWT admin.
 */
export const streakAlerts = catchAsync(async (req: Request, res: Response) => {
  const adminSecret = process.env.ADMIN_SECRET;
  const isSecretAuth = adminSecret && req.headers['x-admin-secret'] === adminSecret;
  const isJwtAdmin = !!(req as any).user?.id;
  if (!isSecretAuth && !isJwtAdmin) throw new UnauthorizedError('Admin authentication required.');

  const today = new Date().toISOString().slice(0, 10);

  // Find users with an active streak
  const { data: activeUsers, error } = await supabase
    .from('profiles')
    .select('id, current_streak')
    .gt('current_streak', 0);

  if (error) throw new InternalServerError('Failed to fetch profiles.');

  // Find which of those have already checked in today
  const userIds = (activeUsers ?? []).map((u: any) => u.id);
  if (userIds.length === 0) return res.json({ alerted: 0 });

  const { data: checkedIn } = await supabase
    .from('checkins')
    .select('user_id')
    .eq('date', today)
    .in('user_id', userIds);

  const checkedInSet = new Set((checkedIn ?? []).map((c: any) => c.user_id));

  const { pushNotification } = await import('./notificationController');
  let alerted = 0;

  for (const user of (activeUsers ?? [])) {
    if (checkedInSet.has(user.id)) continue; // already checked in
    pushNotification({
      userId: user.id,
      type: 'streak_alert',
      title: `Your ${user.current_streak}-day streak is at risk!`,
      body: "Check in before midnight to keep your streak alive.",
      link: '/dashboard',
    }).catch(err => logger.warn('Fire-and-forget failed:', err?.message));
    alerted++;
  }

  logger.info(`[StreakAlerts] Notified ${alerted} at-risk users`);
  return res.json({ alerted, total_with_streak: userIds.length, already_checked_in: checkedInSet.size });
});

// ── OSM Place Import ──────────────────────────────────────────────────────────

export const importOSMPlacesEndpoint = catchAsync(async (req: Request, res: Response) => {
  const { city, dryRun } = req.body;
  if (!city || typeof city !== 'string') {
    throw new BadRequestError('city is required (e.g. "Verona")');
  }

  // Use the authenticated admin's ID as the owner of imported places
  const ownerId = (req as any).user?.id;
  if (!ownerId) throw new UnauthorizedError('Admin user ID required');

  const result = await importOSMPlaces(city, ownerId, {
    dryRun: !!dryRun,
    skipExisting: true,
  });

  res.json({
    success: true,
    city,
    dryRun: !!dryRun,
    ...result,
  });
});
