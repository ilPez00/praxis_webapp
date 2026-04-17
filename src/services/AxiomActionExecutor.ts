/**
 * Axiom Action Executor
 * Pure async action helpers — decoupled from Express
 * All methods take userId as first arg, return { success, result, error }
 * Used by Axiom during midnight scan to take autonomous actions
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface ActionResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
}

export interface CreateBetParams {
  goalName: string;
  deadline: string;       // ISO 8601 datetime
  stakePoints: number;
  goalNodeId?: string;
  opponentType?: 'self' | 'duel';
}

export interface CreateDuelParams {
  title: string;
  description?: string;
  category: string;
  stakePP: number;
  deadlineDays: number;
  opponentId?: string;
  goalNodeId?: string;
}

export interface CreateTeamChallengeParams {
  title: string;
  description?: string;
  domain?: string;
  stakePP?: number;
  deadlineDays?: number;
  maxMembers?: number;
  teamName?: string;
}

export interface LogTrackerParams {
  type: string;
  data: Record<string, any>;
  loggedAt?: string;
}

export interface CreateGoalParams {
  name: string;
  domain: string;
  description?: string;
  completionMetric?: string;
  targetDate?: string;
  parentId?: string;
}

export interface UpdateGoalProgressParams {
  goalId: string;
  progress: number;  // 0-100
  reasoning?: string;
}

export interface CreateNotebookEntryParams {
  title?: string;
  content: string;
  mood?: string;
  domain?: string;
  entryType?: string;
  goalId?: string;
  attachments?: any[];
}

export interface PushNotificationParams {
  title: string;
  body: string;
  type?: string;
}

const MAX_ACTIVE_BETS = 3;
const MAX_STAKE_RATIO = 0.5;
const MAX_STAKE_CAP = 500;
const MAX_DUELS_PER_GOAL_PER_WEEK = 1;
const MAX_GOALS_PER_TREE = 20;
const MAX_TRACKER_LOGS_PER_DAY = 3;
const MAX_NOTIFICATIONS_PER_DAY = 2;
const MAX_ACTIONS_PER_SCAN = 5;
const MAX_PROGRESS_CHANGE_PER_SCAN = 25; // percent

class AxiomActionExecutor {
  /**
   * Create a self-bet or duel bet
   */
  async createBet(userId: string, params: CreateBetParams): Promise<ActionResult> {
    try {
      const { goalName, deadline, stakePoints, goalNodeId, opponentType = 'self' } = params;

      if (!goalName || !deadline || !stakePoints) {
        return { success: false, error: 'Missing required fields: goalName, deadline, stakePoints' };
      }

      const deadlineDate = new Date(deadline);
      const now = new Date();
      if (isNaN(deadlineDate.getTime()) || deadlineDate <= now) {
        return { success: false, error: 'Bet deadline must be in the future' };
      }

      // Check user balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('praxis_points, name')
        .eq('id', userId)
        .single();

      const currentPoints: number = profile?.praxis_points ?? 100;
      if (currentPoints < stakePoints) {
        return { success: false, error: `Insufficient PP (have ${currentPoints}, need ${stakePoints})` };
      }

      const maxStake = Math.min(MAX_STAKE_CAP, Math.floor(currentPoints * MAX_STAKE_RATIO));
      if (stakePoints > maxStake) {
        return { success: false, error: `Maximum stake is ${maxStake} PP (50% of balance)` };
      }

      // Check active bet limit
      const { count: activeBetCount } = await supabase
        .from('bets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active');

      if ((activeBetCount ?? 0) >= MAX_ACTIVE_BETS) {
        return { success: false, error: `Max ${MAX_ACTIVE_BETS} active bets allowed` };
      }

      // Deduct points
      await supabase
        .from('profiles')
        .update({ praxis_points: currentPoints - stakePoints })
        .eq('id', userId);

      // Create bet
      const { data: bet, error: betError } = await supabase
        .from('bets')
        .insert({
          user_id: userId,
          goal_node_id: goalNodeId || null,
          goal_name: goalName,
          deadline,
          stake_points: stakePoints,
          status: 'active',
        })
        .select()
        .single();

      if (betError) {
        await supabase.from('profiles').update({ praxis_points: currentPoints }).eq('id', userId);
        return { success: false, error: `Bet creation failed: ${betError.message}` };
      }

      logger.info(`[AxiomAction] Bet created for user ${userId}: ${bet.id} (${stakePoints} PP on "${goalName}")`);

      return { success: true, result: { betId: bet.id, stakePoints, goalName, deadline } };
    } catch (err: any) {
      logger.error(`[AxiomAction] createBet failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a duel challenge
   */
  async createDuel(userId: string, params: CreateDuelParams): Promise<ActionResult> {
    try {
      const { title, description, category, stakePP, deadlineDays, opponentId, goalNodeId } = params;

      if (!title || !category) {
        return { success: false, error: 'Missing required fields: title, category' };
      }

      const stake = Math.max(10, Math.min(stakePP || 50, 5000));
      const days = Math.max(1, Math.min(deadlineDays || 7, 90));

      // Check goal-specific weekly limit
      if (goalNodeId) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: recentDuels } = await supabase
          .from('duels')
          .select('id', { count: 'exact', head: true })
          .eq('creator_id', userId)
          .eq('goal_node_id', goalNodeId)
          .gte('created_at', weekAgo.toISOString());

        if ((recentDuels ?? 0) >= MAX_DUELS_PER_GOAL_PER_WEEK) {
          return { success: false, error: `Max ${MAX_DUELS_PER_GOAL_PER_WEEK} duel per goal per week` };
        }
      }

      // Deduct stake
      const { data: profile } = await supabase
        .from('profiles')
        .select('praxis_points')
        .eq('id', userId)
        .single();

      if ((profile?.praxis_points ?? 0) < stake) {
        return { success: false, error: `Insufficient PP (need ${stake})` };
      }

      await supabase
        .from('profiles')
        .update({ praxis_points: (profile?.praxis_points ?? 0) - stake })
        .eq('id', userId);

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + days);
      const status = opponentId ? 'pending' : 'open';

      const { data: duel, error: duelError } = await supabase
        .from('duels')
        .insert({
          creator_id: userId,
          opponent_id: opponentId || null,
          goal_node_id: goalNodeId || null,
          title: title.trim(),
          description: description?.trim() || null,
          category: category.trim(),
          stake_pp: stake,
          deadline_days: days,
          deadline: deadline.toISOString().slice(0, 10),
          status,
        })
        .select()
        .single();

      if (duelError) {
        await supabase.from('profiles').update({ praxis_points: profile?.praxis_points ?? 0 }).eq('id', userId);
        return { success: false, error: `Duel creation failed: ${duelError.message}` };
      }

      logger.info(`[AxiomAction] Duel created for user ${userId}: ${duel.id} (${stake} PP, "${title}")`);

      return { success: true, result: { duelId: duel.id, stakePP: stake, title, deadlineDays: days } };
    } catch (err: any) {
      logger.error(`[AxiomAction] createDuel failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a team challenge
   */
  async createTeamChallenge(userId: string, params: CreateTeamChallengeParams): Promise<ActionResult> {
    try {
      const { title, description, domain, stakePP = 50, deadlineDays = 7, maxMembers = 10, teamName } = params;

      if (!title) {
        return { success: false, error: 'Missing required field: title' };
      }

      // Create chat room for team
      const { data: teamRoom, error: teamError } = await supabase
        .from('chat_rooms')
        .insert({
          name: teamName || `${title} Team`,
          description: description || `Team for challenge: ${title}`,
          domain: domain || null,
          type: 'challenge_team',
          creator_id: userId,
        })
        .select()
        .single();

      if (teamError) {
        return { success: false, error: `Failed to create team room: ${teamError.message}` };
      }

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + (deadlineDays || 7));

      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .insert({
          title,
          description,
          domain,
          stake_pp: stakePP,
          deadline: deadline.toISOString(),
          deadline_days: deadlineDays || 7,
          creator_id: userId,
          is_team: true,
          max_members: maxMembers,
          team_id: teamRoom.id,
        })
        .select()
        .single();

      if (challengeError) {
        await supabase.from('chat_rooms').delete().eq('id', teamRoom.id);
        return { success: false, error: `Failed to create challenge: ${challengeError.message}` };
      }

      // Add creator as first member
      await supabase
        .from('chat_room_members')
        .upsert({ room_id: teamRoom.id, user_id: userId }, { onConflict: 'room_id,user_id' });

      const { data: teamParticipant } = await supabase
        .from('team_challenge_participants')
        .insert({ challenge_id: challenge.id, team_id: teamRoom.id })
        .select()
        .single();

      if (teamParticipant) {
        await supabase
          .from('team_challenge_members')
          .insert({ team_participant_id: teamParticipant.id, user_id: userId });
      }

      logger.info(`[AxiomAction] Team challenge created for user ${userId}: ${challenge.id} ("${title}")`);

      return { success: true, result: { challengeId: challenge.id, teamRoomId: teamRoom.id, title } };
    } catch (err: any) {
      logger.error(`[AxiomAction] createTeamChallenge failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Log a tracker entry
   */
  async logTracker(userId: string, params: LogTrackerParams): Promise<ActionResult> {
    try {
      const { type, data, loggedAt } = params;

      if (!type || !data) {
        return { success: false, error: 'Missing required fields: type, data' };
      }

      // Get or create tracker
      const { data: tracker, error: upsertErr } = await supabase
        .from('trackers')
        .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })
        .select('id')
        .single();

      if (upsertErr) {
        return { success: false, error: `Tracker upsert failed: ${upsertErr.message}` };
      }

      // Check daily limit
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('tracker_entries')
        .select('id', { count: 'exact', head: true })
        .eq('tracker_id', tracker.id)
        .eq('user_id', userId)
        .gte('created_at', todayStart.toISOString());

      if ((todayCount ?? 0) >= MAX_TRACKER_LOGS_PER_DAY) {
        return { success: false, error: `Daily tracker limit reached (${MAX_TRACKER_LOGS_PER_DAY} per day)` };
      }

      // Insert entry
      const { error: insertErr } = await supabase
        .from('tracker_entries')
        .insert({
          tracker_id: tracker.id,
          user_id: userId,
          data,
          logged_at: loggedAt || new Date().toISOString(),
        });

      if (insertErr) {
        return { success: false, error: `Tracker log failed: ${insertErr.message}` };
      }

      logger.info(`[AxiomAction] Tracker logged for user ${userId}: ${type} -> ${JSON.stringify(data)}`);

      return { success: true, result: { trackerId: tracker.id, type, data } };
    } catch (err: any) {
      logger.error(`[AxiomAction] logTracker failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a new goal node in user's goal tree
   */
  async createGoal(userId: string, params: CreateGoalParams): Promise<ActionResult> {
    try {
      const { name, domain, description, completionMetric, targetDate, parentId } = params;

      if (!name || !domain) {
        return { success: false, error: 'Missing required fields: name, domain' };
      }

      const { data: goalTree } = await supabase
        .from('goal_trees')
        .select('id, nodes, root_nodes')
        .eq('user_id', userId)
        .single();

      if (!goalTree) {
        return { success: false, error: 'No goal tree found for user' };
      }

      const nodes = Array.isArray(goalTree.nodes) ? goalTree.nodes : [];
      if (nodes.length >= MAX_GOALS_PER_TREE) {
        return { success: false, error: `Max ${MAX_GOALS_PER_TREE} goals per tree` };
      }

      const newNode = {
        id: crypto.randomUUID(),
        name: name.trim(),
        domain,
        description: description?.trim() || '',
        progress: 0,
        completion_metric: completionMetric || '',
        target_date: targetDate || null,
        parent_id: parentId || null,
        children: [],
        weight: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedNodes = parentId
        ? nodes.map((n: any) => {
            if (n.id === parentId) {
              return { ...n, children: [...(n.children || []), newNode.id] };
            }
            return n;
          })
        : [...nodes, newNode];

      updatedNodes.push(newNode);

      const { error: updateErr } = await supabase
        .from('goal_trees')
        .update({ nodes: updatedNodes, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (updateErr) {
        return { success: false, error: `Goal creation failed: ${updateErr.message}` };
      }

      logger.info(`[AxiomAction] Goal created for user ${userId}: "${name}" (${domain})`);

      return { success: true, result: { goalId: newNode.id, name, domain } };
    } catch (err: any) {
      logger.error(`[AxiomAction] createGoal failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Update an existing goal's progress
   */
  async updateGoalProgress(userId: string, params: UpdateGoalProgressParams): Promise<ActionResult> {
    try {
      const { goalId, progress, reasoning } = params;

      if (!goalId || progress === undefined) {
        return { success: false, error: 'Missing required fields: goalId, progress' };
      }

      if (progress < 0 || progress > 100) {
        return { success: false, error: 'Progress must be between 0 and 100' };
      }

      const { data: tree } = await supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .maybeSingle();

      if (!tree?.nodes) {
        return { success: false, error: 'No goal tree found' };
      }

      const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
      const nodeIndex = nodes.findIndex((n: any) => n.id === goalId);
      if (nodeIndex === -1) {
        return { success: false, error: `Goal ${goalId} not found` };
      }

      const oldProgress = Math.round((nodes[nodeIndex].progress || 0) * 100);
      const progressChange = Math.abs(progress - oldProgress);

      // Guardrail: max ±25% change per scan
      if (progressChange > MAX_PROGRESS_CHANGE_PER_SCAN) {
        return {
          success: false,
          error: `Progress change too large (${progressChange}%). Max ${MAX_PROGRESS_CHANGE_PER_SCAN}% per scan.`,
        };
      }

      nodes[nodeIndex] = {
        ...nodes[nodeIndex],
        progress: progress / 100,
        updated_at: new Date().toISOString(),
        progress_updated_by: 'axiom_auto',
        progress_reasoning: reasoning || null,
      };

      await supabase
        .from('goal_trees')
        .update({ nodes })
        .eq('user_id', userId);

      logger.info(`[AxiomAction] Goal progress updated for ${userId}: ${goalId} ${oldProgress}% → ${progress}%`);

      return { success: true, result: { goalId, oldProgress, newProgress: progress } };
    } catch (err: any) {
      logger.error(`[AxiomAction] updateGoalProgress failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a notebook entry
   */
  async createNotebookEntry(userId: string, params: CreateNotebookEntryParams): Promise<ActionResult> {
    try {
      const { title, content, mood, domain, entryType = 'note', goalId, attachments } = params;

      if (!content) {
        return { success: false, error: 'Missing required field: content' };
      }

      const { data: entry, error } = await supabase
        .from('notebook_entries')
        .insert({
          user_id: userId,
          entry_type: entryType,
          title: title || null,
          content,
          mood: mood || null,
          domain: domain || null,
          goal_id: goalId || null,
          attachments: attachments || [],
          occurred_at: new Date().toISOString(),
          metadata: { created_by: 'axiom', scan_type: 'midnight_scan' },
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: `Notebook entry failed: ${error.message}` };
      }

      logger.info(`[AxiomAction] Notebook entry created for ${userId}: ${entry.id}`);

      return { success: true, result: { entryId: entry.id, title, entryType } };
    } catch (err: any) {
      logger.error(`[AxiomAction] createNotebookEntry failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a push notification to user
   */
  async pushNotification(userId: string, params: PushNotificationParams): Promise<ActionResult> {
    try {
      const { title, body, type = 'axiom_action' } = params;

      if (!title || !body) {
        return { success: false, error: 'Missing required fields: title, body' };
      }

      // Check daily notification limit
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('push_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'axiom_action')
        .gte('created_at', todayStart.toISOString());

      if ((todayCount ?? 0) >= MAX_NOTIFICATIONS_PER_DAY) {
        return { success: false, error: `Daily notification limit reached (${MAX_NOTIFICATIONS_PER_DAY})` };
      }

      const { pushNotification } = await import('../controllers/notificationController');
      await pushNotification({ userId, title, body, type });

      logger.info(`[AxiomAction] Notification sent to ${userId}: "${title}"`);

      return { success: true, result: { title, body } };
    } catch (err: any) {
      logger.error(`[AxiomAction] pushNotification failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Suggest a sparring partner match
   */
  async suggestMatch(userId: string, _params: { goalId?: string } = {}): Promise<ActionResult> {
    try {
      const { data: matches } = await supabase.rpc('match_users_by_goals', {
        query_user_id: userId,
        match_limit: 1,
      });

      if (!matches || matches.length === 0) {
        return { success: false, error: 'No matching users found' };
      }

      const match = matches[0];
      logger.info(`[AxiomAction] Match suggested for ${userId}: ${match.user_id || match.id}`);

      return { success: true, result: { matchUserId: match.user_id || match.id, matchName: match.name || 'Someone' } };
    } catch (err: any) {
      logger.error(`[AxiomAction] suggestMatch failed for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

export const axiomActionExecutor = new AxiomActionExecutor();
export default axiomActionExecutor;
