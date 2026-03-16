import { supabase } from '../lib/supabase';

export type NotebookActionType =
  | 'goal_created'
  | 'goal_updated'
  | 'goal_deleted'
  | 'goal_suspended'
  | 'goal_resumed'
  | 'goal_completed'
  | 'chapter_created'
  | 'chapter_updated'
  | 'chapter_deleted';

export interface NotebookActivityLog {
  user_id: string;
  action_type: NotebookActionType;
  node_id?: string;
  node_name?: string;
  domain?: string;
  parent_id?: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Log notebook hierarchy changes to activity log
 */
export async function logNotebookActivity(log: NotebookActivityLog): Promise<void> {
  try {
    await supabase
      .from('notebook_activity_log')
      .insert({
        ...log,
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Failed to log notebook activity:', error);
    // Don't throw - logging failure shouldn't block the main operation
  }
}

/**
 * Helper to create activity log for goal creation
 */
export async function logGoalCreation(
  userId: string,
  nodeId: string,
  nodeName: string,
  domain: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logNotebookActivity({
    user_id: userId,
    action_type: 'goal_created',
    node_id: nodeId,
    node_name: nodeName,
    domain,
    new_value: { name: nodeName, domain },
    metadata,
  });
}

/**
 * Helper to create activity log for goal update
 */
export async function logGoalUpdate(
  userId: string,
  nodeId: string,
  nodeName: string,
  domain: string,
  oldValue: Record<string, any>,
  newValue: Record<string, any>,
  metadata?: Record<string, any>
): Promise<void> {
  await logNotebookActivity({
    user_id: userId,
    action_type: 'goal_updated',
    node_id: nodeId,
    node_name: nodeName,
    domain,
    old_value: oldValue,
    new_value: newValue,
    metadata,
  });
}

/**
 * Helper to create activity log for goal suspension
 */
export async function logGoalSuspension(
  userId: string,
  nodeId: string,
  nodeName: string,
  domain: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logNotebookActivity({
    user_id: userId,
    action_type: 'goal_suspended',
    node_id: nodeId,
    node_name: nodeName,
    domain,
    metadata,
  });
}

/**
 * Helper to create activity log for chapter creation
 */
export async function logChapterCreation(
  userId: string,
  nodeId: string,
  nodeName: string,
  parentId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logNotebookActivity({
    user_id: userId,
    action_type: 'chapter_created',
    node_id: nodeId,
    node_name: nodeName,
    parent_id: parentId,
    new_value: { name: nodeName, parentId },
    metadata,
  });
}
