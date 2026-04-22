import { Router } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase } from '../lib/supabaseClient';
import { randomBytes } from 'crypto';

const router = Router();

function generateApiKey(): string {
  return 'pk_live_' + randomBytes(24).toString('hex');
}

async function authenticateApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith('pk_live_')) return null;

  const { data, error } = await supabase
    .from('agent_keys')
    .select('user_id, expires_at, revoked_at')
    .eq('api_key', apiKey)
    .single();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  await supabase
    .from('agent_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key', apiKey);

  return data.user_id;
}

function createMcpServer(userId: string) {
  const server = new McpServer({
    name: 'praxis',
    version: '1.0.0',
  });

  // ==================== AUTH TOOLS ====================
  server.tool(
    'login',
    'Login to Praxis with email and password',
    {
      email: z.string().email().describe('User email address'),
      password: z.string().min(1).describe('User password'),
    },
    async ({ email, password }) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Logged in as user ' + data.user?.id }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Login failed: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'signup',
    'Create a new Praxis account',
    {
      email: z.string().email().describe('User email'),
      password: z.string().min(8).describe('Password'),
      name: z.string().describe('Display name'),
      age: z.number().describe('Age'),
      bio: z.string().describe('Bio'),
    },
    async ({ email, password, name, age, bio }) => {
      try {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, age, bio } } });
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Account created. Check email to verify.' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Signup failed: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== PROFILE TOOLS ====================
  server.tool(
    'get_profile',
    'Get your profile',
    {},
    async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_user',
    'Get another user profile',
    { userId: z.string().describe('User ID') },
    async ({ userId: targetId }) => {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', targetId).single();
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_leaderboard',
    'Get leaderboard',
    {},
    async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('id, name, praxis_points, current_streak').order('praxis_points', { ascending: false }).limit(100);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'update_profile',
    'Update your profile',
    {
      name: z.string().optional(),
      bio: z.string().optional(),
      city: z.string().optional(),
    },
    async (args) => {
      try {
        const { error } = await supabase.from('profiles').update(args).eq('id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Profile updated' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== GOAL TOOLS ====================
  server.tool(
    'get_goals',
    'Get your goals',
    {},
    async () => {
      try {
        const { data, error } = await supabase.from('goal_tree_nodes').select('*').eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_goal',
    'Create a new goal',
    {
      name: z.string().describe('Goal name'),
      description: z.string().optional(),
      target: z.number().optional(),
    },
    async ({ name, description, target }) => {
      try {
        const { data, error } = await supabase.from('goal_tree_nodes').insert({
          user_id: userId,
          name,
          description,
          target,
          progress: 0,
        }).select().single();
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Goal created: ' + JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'delete_goal',
    'Delete a goal',
    { goalId: z.string().describe('Goal ID') },
    async ({ goalId }) => {
      try {
        const { error } = await supabase.from('goal_tree_nodes').delete().eq('id', goalId).eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Goal deleted' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'update_progress',
    'Update goal progress',
    {
      goalId: z.string().describe('Goal ID'),
      progress: z.number().describe('Progress 0-100'),
      note: z.string().optional(),
    },
    async ({ goalId, progress, note }) => {
      try {
        const { error } = await supabase.from('goal_tree_nodes').update({ progress: progress / 100 }).eq('id', goalId).eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Progress updated to ' + progress + '%' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== CHECK-IN TOOLS ====================
  server.tool(
    'get_today_checkin',
    'Get today check-in',
    {},
    async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase.from('checkins').select('*').eq('user_id', userId).gte('created_at', today).single();
        if (error && error.code !== 'PGRST116') throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data || null, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_checkin',
    'Create daily check-in',
    {
      mood: z.number().min(1).max(10).optional(),
      notes: z.string().optional(),
    },
    async ({ mood, notes }) => {
      try {
        const { data, error } = await supabase.from('checkins').insert({ user_id: userId, mood, notes }).select().single();
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Check-in created: ' + JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_checkin_history',
    'Get check-in history',
    { days: z.number().optional() },
    async ({ days = 7 }) => {
      try {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase.from('checkins').select('*').eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false });
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== NOTEBOOK TOOLS ====================
  server.tool(
    'get_notebook',
    'Get notebook entries',
    { limit: z.number().optional() },
    async ({ limit = 20 }) => {
      try {
        const { data, error } = await supabase.from('notebook').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_notebook_entry',
    'Create notebook entry',
    {
      content: z.string().describe('Entry content'),
      nodeId: z.string().optional(),
    },
    async ({ content, nodeId }) => {
      try {
        const { data, error } = await supabase.from('notebook').insert({ user_id: userId, content, node_id: nodeId }).select().single();
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Entry created: ' + JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'search_notebook',
    'Search notebook',
    { query: z.string().describe('Search query') },
    async ({ query }) => {
      try {
        const { data, error } = await supabase.from('notebook').select('*').eq('user_id', userId).ilike('content', '%' + query + '%');
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== DIARY TOOLS ====================
  server.tool(
    'get_diary',
    'Get diary entries',
    { date: z.string().optional() },
    async ({ date }) => {
      try {
        const d = date || new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase.from('diary').select('*').eq('user_id', userId).eq('date', d);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_diary_entry',
    'Create diary entry',
    {
      content: z.string().describe('Diary content'),
      mood: z.number().optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ content, mood, tags }) => {
      try {
        const { data, error } = await supabase.from('diary').insert({
          user_id: userId,
          date: new Date().toISOString().slice(0, 10),
          content,
          mood,
          tags,
        }).select().single();
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Diary entry created' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== MESSAGE TOOLS ====================
  server.tool(
    'get_conversations',
    'Get conversations',
    {},
    async () => {
      try {
        const { data: sent } = await supabase.from('messages').select('receiver_id').eq('sender_id', userId);
        const { data: received } = await supabase.from('messages').select('sender_id').eq('receiver_id', userId);
        const userIds = new Set([...(sent || []).map((m: any) => m.receiver_id), ...(received || []).map((m: any) => m.sender_id)]);
        return { content: [{ type: 'text', text: JSON.stringify(Array.from(userIds), null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_messages',
    'Get messages with user',
    {
      userId: z.string().describe('Other user ID'),
      limit: z.number().optional(),
    },
    async ({ userId: otherId, limit = 50 }) => {
      try {
        const { data, error } = await supabase.from('messages')
          .select('*')
          .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'send_message',
    'Send message',
    {
      receiverId: z.string().describe('Receiver ID'),
      content: z.string().describe('Message'),
    },
    async ({ receiverId, content }) => {
      try {
        const { data, error } = await supabase.from('messages').insert({ sender_id: userId, receiver_id: receiverId, content }).select().single();
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Message sent' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== GAMIFICATION TOOLS ====================
  server.tool(
    'get_stats',
    'Get profile stats',
    {},
    async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('praxis_points, current_streak, total_checkins, created_at').eq('id', userId).single();
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_streak',
    'Get current streak',
    {},
    async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('current_streak').eq('id', userId).single();
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Current streak: ' + data.current_streak + ' days' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_achievements',
    'Get achievements',
    {},
    async () => {
      try {
        const { data, error } = await supabase.from('user_achievements').select('*, achievements(*)').eq('user_id', userId);
        if (error) throw error;
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== POINTS TOOLS ====================
  server.tool(
    'get_points',
    'Get current points',
    {},
    async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
        if (error) throw error;
        return { content: [{ type: 'text', text: 'Points: ' + data.praxis_points }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== SEARCH TOOLS ====================
  server.tool(
    'search',
    'Search goals and notebook',
    { query: z.string().describe('Search query') },
    async ({ query }) => {
      try {
        const [goals, notebook] = await Promise.all([
          supabase.from('goal_tree_nodes').select('*').eq('user_id', userId).ilike('name', '%' + query + '%'),
          supabase.from('notebook').select('*').eq('user_id', userId).ilike('content', '%' + query + '%'),
        ]);
        return { content: [{ type: 'text', text: JSON.stringify({ goals: goals.data, notebook: notebook.data }, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  return server;
}

// MCP POST handler
router.post('/', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  const userId = await authenticateApiKey(apiKey);
  
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or missing API key. Provide X-API-Key header.' });
  }

  const server = createMcpServer(userId);
  
  try {
    await server.connect();
  } catch (err) {
    console.error('MCP error:', err);
    res.status(500).json({ error: 'MCP server error' });
  }
});

// Health check
router.get('/', (req, res) => {
  res.json({ 
    name: 'praxis', 
    version: '1.0.0',
    description: 'MCP server for Praxis - AI goal journal',
    tools: [
      'login', 'signup', 'get_profile', 'get_user', 'get_leaderboard', 'update_profile',
      'get_goals', 'create_goal', 'delete_goal', 'update_progress',
      'get_today_checkin', 'create_checkin', 'get_checkin_history',
      'get_notebook', 'create_notebook_entry', 'search_notebook',
      'get_diary', 'create_diary_entry',
      'get_conversations', 'get_messages', 'send_message',
      'get_stats', 'get_streak', 'get_achievements',
      'get_points', 'search'
    ]
  });
});

export default router;
