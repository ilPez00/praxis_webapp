/**
 * Axiom Action Router
 * Tool-calling interface for agentic Axiom
 * Validates AI decisions, routes to executors, logs to audit table
 */

import { z } from 'zod';
import { supabase } from '../lib/supabaseClient';
import { axiomActionExecutor, ActionResult } from './AxiomActionExecutor';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Tool Definitions — Zod schemas for AI parameter guidance
// ---------------------------------------------------------------------------

export const toolSchemas = {
  create_bet: z.object({
    goalName: z.string().min(1).max(200).describe('Name of the goal to bet on'),
    deadline: z.string().datetime().describe('Bet deadline in ISO 8601 format (must be in future)'),
    stakePoints: z.number().int().min(1).max(500).describe('Points to stake (max 500)'),
    goalNodeId: z.string().uuid().optional().describe('Optional goal node UUID'),
    opponentType: z.enum(['self', 'duel']).default('self').describe("Bet type: 'self' or 'duel'"),
  }),

  create_duel: z.object({
    title: z.string().min(1).max(200).describe('Duel title/challenge name'),
    description: z.string().max(1000).optional().describe('Challenge description'),
    category: z.string().min(1).max(100).describe('Category (e.g., Fitness, Career, Learning)'),
    stakePP: z.number().int().min(10).max(5000).default(50).describe('Points to stake'),
    deadlineDays: z.number().int().min(1).max(90).default(7).describe('Days until deadline'),
    opponentId: z.string().uuid().optional().describe('Optional opponent user ID'),
    goalNodeId: z.string().uuid().optional().describe('Optional goal node UUID'),
  }),

  create_team_challenge: z.object({
    title: z.string().min(1).max(200).describe('Challenge title'),
    description: z.string().max(1000).optional().describe('Challenge description'),
    domain: z.string().optional().describe('Domain (Fitness, Career, etc.)'),
    stakePP: z.number().int().min(10).default(50).describe('Points per member'),
    deadlineDays: z.number().int().min(1).default(7).describe('Days until deadline'),
    maxMembers: z.number().int().min(2).default(10).describe('Max team members'),
    teamName: z.string().max(100).optional().describe('Team name'),
  }),

  log_tracker: z.object({
    type: z.string().min(1).max(50).describe('Tracker type (e.g., habit, objective, mood)'),
    data: z.record(z.string(), z.any()).describe('Tracker data as key-value pairs'),
    loggedAt: z.string().datetime().optional().describe('Optional log timestamp'),
  }),

  create_goal: z.object({
    name: z.string().min(3).max(200).describe('Goal name'),
    domain: z.enum(['Fitness', 'Career', 'Learning', 'Relationships', 'Finance', 'Creative', 'Health', 'Spiritual', 'Business', 'Personal']).describe('Goal domain'),
    description: z.string().max(1000).optional().describe('Goal description'),
    completionMetric: z.string().max(500).optional().describe('How to measure completion'),
    targetDate: z.string().datetime().optional().describe('Target completion date'),
    parentId: z.string().uuid().optional().describe('Parent goal UUID for sub-goals'),
  }),

  update_goal_progress: z.object({
    goalId: z.string().uuid().describe('Goal node UUID'),
    progress: z.number().min(0).max(100).describe('New progress percentage (0-100)'),
    reasoning: z.string().max(500).optional().describe('Why progress changed'),
  }),

  create_notebook_entry: z.object({
    title: z.string().max(200).optional().describe('Entry title'),
    content: z.string().min(1).max(10000).describe('Entry content'),
    mood: z.string().max(10).optional().describe('Mood emoji'),
    domain: z.string().optional().describe('Domain tag'),
    entryType: z.enum(['note', 'journal', 'reflection', 'goal_progress']).default('note').describe('Entry type'),
    goalId: z.string().uuid().optional().describe('Associated goal UUID'),
  }),

  push_notification: z.object({
    title: z.string().min(1).max(100).describe('Notification title'),
    body: z.string().min(1).max(500).describe('Notification body text'),
    type: z.string().max(50).default('axiom_action').describe('Notification type'),
  }),

  suggest_match: z.object({
    goalId: z.string().uuid().optional().describe('Optional goal UUID to match on'),
  }),
};

export type ToolName = keyof typeof toolSchemas;

// ---------------------------------------------------------------------------
// Raw action call from AI
// ---------------------------------------------------------------------------

export interface ActionCall {
  tool: ToolName;
  params: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Log action to audit table
// ---------------------------------------------------------------------------

async function logAction(
  userId: string,
  actionType: string,
  params: Record<string, any>,
  result: ActionResult,
  scanType: string = 'midnight_scan'
): Promise<void> {
  try {
    await supabase.from('axiom_actions').insert({
      user_id: userId,
      action_type: actionType,
      params,
      result: { success: result.success, result: result.result, error: result.error },
      scan_type: scanType,
      created_by: 'axiom',
    });
  } catch (err: any) {
    logger.warn(`[AxiomActionRouter] Failed to log action: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Route a single action
// ---------------------------------------------------------------------------

export async function routeAction(
  userId: string,
  action: ActionCall,
  scanType: string = 'midnight_scan'
): Promise<ActionResult> {
  const { tool, params: rawParams } = action;

  // Validate schema
  const schema = toolSchemas[tool];
  if (!schema) {
    const err = `Unknown tool: ${tool}`;
    logger.warn(`[AxiomActionRouter] ${err}`);
    return { success: false, error: err };
  }

  const parsed = schema.safeParse(rawParams);
  if (!parsed.success) {
    const err = `Invalid params for ${tool}: ${parsed.error.message}`;
    logger.warn(`[AxiomActionRouter] ${err}`);
    return { success: false, error: err };
  }

  const params = parsed.data;

  let result: ActionResult;

  switch (tool) {
    case 'create_bet': {
      const p = params as z.infer<typeof toolSchemas.create_bet>;
      result = await axiomActionExecutor.createBet(userId, p);
      break;
    }
    case 'create_duel': {
      const p = params as z.infer<typeof toolSchemas.create_duel>;
      result = await axiomActionExecutor.createDuel(userId, p);
      break;
    }
    case 'create_team_challenge': {
      const p = params as z.infer<typeof toolSchemas.create_team_challenge>;
      result = await axiomActionExecutor.createTeamChallenge(userId, p);
      break;
    }
    case 'log_tracker': {
      const p = params as z.infer<typeof toolSchemas.log_tracker>;
      result = await axiomActionExecutor.logTracker(userId, p);
      break;
    }
    case 'create_goal': {
      const p = params as z.infer<typeof toolSchemas.create_goal>;
      result = await axiomActionExecutor.createGoal(userId, p);
      break;
    }
    case 'update_goal_progress': {
      const p = params as z.infer<typeof toolSchemas.update_goal_progress>;
      result = await axiomActionExecutor.updateGoalProgress(userId, p);
      break;
    }
    case 'create_notebook_entry': {
      const p = params as z.infer<typeof toolSchemas.create_notebook_entry>;
      result = await axiomActionExecutor.createNotebookEntry(userId, p);
      break;
    }
    case 'push_notification': {
      const p = params as z.infer<typeof toolSchemas.push_notification>;
      result = await axiomActionExecutor.pushNotification(userId, p);
      break;
    }
    case 'suggest_match': {
      const p = params as z.infer<typeof toolSchemas.suggest_match>;
      result = await axiomActionExecutor.suggestMatch(userId, p);
      break;
    }
    default:
      result = { success: false, error: `Unhandled tool: ${tool}` };
  }

  await logAction(userId, tool, rawParams, result, scanType);

  return result;
}

// ---------------------------------------------------------------------------
// Route multiple actions (with global cap)
// ---------------------------------------------------------------------------

const MAX_ACTIONS_PER_SCAN = 5;

export async function routeActions(
  userId: string,
  actions: ActionCall[],
  scanType: string = 'midnight_scan'
): Promise<{ results: ActionResult[]; skipped: number }> {
  const capped = actions.slice(0, MAX_ACTIONS_PER_SCAN);
  const skipped = Math.max(0, actions.length - MAX_ACTIONS_PER_SCAN);

  if (skipped > 0) {
    logger.info(`[AxiomActionRouter] Capped ${actions.length} actions to ${MAX_ACTIONS_PER_SCAN} for user ${userId}`);
  }

  const results: ActionResult[] = [];
  for (const action of capped) {
    const result = await routeAction(userId, action, scanType);
    results.push(result);
    // Small delay between actions
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { results, skipped };
}

// ---------------------------------------------------------------------------
// Generate Gemini function declarations for tool-calling
// ---------------------------------------------------------------------------

export function getToolDeclarations(): any[] {
  return [
    {
      name: 'create_bet',
      description: 'Create a self-bet or duel on a goal with a deadline and stake. Deducts Praxis Points. Use when user wants accountability or has mentioned wanting to bet on completing something.',
      parameters: {
        type: 'object',
        properties: {
          goalName: { type: 'string', description: 'Name of the goal to bet on' },
          deadline: { type: 'string', description: 'Bet deadline in ISO 8601 format (e.g. 2026-04-25T23:59:59Z). Must be in the future.' },
          stakePoints: { type: 'number', description: 'Points to stake (1-500). Higher stake = more accountability.' },
          goalNodeId: { type: 'string', description: 'Optional goal node UUID if linking to existing goal' },
          opponentType: { type: 'string', enum: ['self', 'duel'], description: "'self' for personal bet, 'duel' to challenge a sparring partner" },
        },
        required: ['goalName', 'deadline', 'stakePoints'],
      },
    },
    {
      name: 'create_duel',
      description: 'Create a timed duel challenge. Deducts PP from creator. Use when user wants competitive accountability with a sparring partner.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Duel title/challenge name' },
          description: { type: 'string', description: 'Challenge description' },
          category: { type: 'string', description: 'Category: Fitness, Career, Learning, Finance, etc.' },
          stakePP: { type: 'number', description: 'Points to stake (10-5000)' },
          deadlineDays: { type: 'number', description: 'Days until deadline (1-90)' },
          opponentId: { type: 'string', description: 'Optional opponent user ID for direct challenge' },
          goalNodeId: { type: 'string', description: 'Optional goal node UUID' },
        },
        required: ['title', 'category'],
      },
    },
    {
      name: 'create_team_challenge',
      description: 'Create a team challenge. Use when user wants group accountability.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Challenge title' },
          description: { type: 'string', description: 'Challenge description' },
          domain: { type: 'string', description: 'Domain: Fitness, Career, Learning, etc.' },
          stakePP: { type: 'number', description: 'Points per member (default 50)' },
          deadlineDays: { type: 'number', description: 'Days until deadline (default 7)' },
          maxMembers: { type: 'number', description: 'Max team members (default 10)' },
          teamName: { type: 'string', description: 'Team name' },
        },
        required: ['title'],
      },
    },
    {
      name: 'log_tracker',
      description: 'Log a data point to a habit or objective tracker. Awards +5 PP. Use when user has been tracking habits.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Tracker type (e.g., habit, objective, mood)' },
          data: { type: 'object', description: 'Tracker data as key-value pairs', additionalProperties: {} },
          loggedAt: { type: 'string', description: 'Optional log timestamp' },
        },
        required: ['type', 'data'],
      },
    },
    {
      name: 'create_goal',
      description: 'Add a new sub-goal to the user goal tree. Use when user mentions a new goal or sub-goal is needed.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Goal name (3-200 chars)' },
          domain: { type: 'string', enum: ['Fitness', 'Career', 'Learning', 'Relationships', 'Finance', 'Creative', 'Health', 'Spiritual', 'Business', 'Personal'], description: 'Goal domain' },
          description: { type: 'string', description: 'Goal description' },
          completionMetric: { type: 'string', description: 'How to measure completion' },
          targetDate: { type: 'string', description: 'Target date in ISO 8601 format' },
          parentId: { type: 'string', description: 'Parent goal UUID for sub-goals' },
        },
        required: ['name', 'domain'],
      },
    },
    {
      name: 'update_goal_progress',
      description: 'Auto-update progress % on an existing goal. Max ±25% per scan. Use when evidence clearly shows progress change.',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'string', description: 'Goal node UUID' },
          progress: { type: 'number', description: 'New progress percentage (0-100)' },
          reasoning: { type: 'string', description: 'Why progress changed' },
        },
        required: ['goalId', 'progress'],
      },
    },
    {
      name: 'create_notebook_entry',
      description: 'Write a note, insight, or reflection to the user notebook. Axiom should use this to document analysis findings.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Entry title' },
          content: { type: 'string', description: 'Entry content' },
          mood: { type: 'string', description: 'Mood emoji' },
          domain: { type: 'string', description: 'Domain tag' },
          entryType: { type: 'string', enum: ['note', 'journal', 'reflection', 'goal_progress'], description: 'Entry type' },
          goalId: { type: 'string', description: 'Associated goal UUID' },
        },
        required: ['content'],
      },
    },
    {
      name: 'push_notification',
      description: 'Send a motivational or reminder push notification. Use sparingly (max 2 per day).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Notification title' },
          body: { type: 'string', description: 'Notification body' },
          type: { type: 'string', description: 'Notification type' },
        },
        required: ['title', 'body'],
      },
    },
    {
      name: 'suggest_match',
      description: 'Find and recommend a sparring partner with similar goals.',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'string', description: 'Optional goal UUID to match on' },
        },
      },
    },
  ];
}
