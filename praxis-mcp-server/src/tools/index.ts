import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { praxisClient } from '../client.js';

export function createTools() {
  const server = new McpServer({
    name: 'praxis',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  });

  // ==================== AUTH TOOLS ====================
  server.tool(
    'login',
    'Login to Praxis with email and password. Stores auth token for subsequent API calls.',
    {
      email: z.string().email().describe('User email address'),
      password: z.string().min(8).describe('User password'),
    },
    async ({ email, password }) => {
      try {
        const res = await praxisClient.loginWithSupabase(email, password);
        return {
          content: [{ type: 'text', text: `Logged in as ${res.user.email || res.user.id}. Auth token stored.` }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Login failed: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'signup',
    'Create a new Praxis account',
    {
      email: z.string().email().describe('User email address'),
      password: z.string().min(8).describe('Password (min 8 chars)'),
      name: z.string().min(2).describe('Display name'),
      age: z.number().min(13).max(120).describe('User age'),
      bio: z.string().max(500).describe('Short bio'),
    },
    async ({ email, password, name, age, bio }) => {
      try {
        const res = await praxisClient.signup(email, password, name, age, bio);
        return { content: [{ type: 'text', text: 'Account created. Check email to verify.' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Signup failed: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'set_token',
    'Set a JWT auth token manually. Get token from browser devtools → Application → Local Storage → supabase.auth.token → access_token. Useful after Google OAuth login on the website.',
    {
      token: z.string().min(10).describe('JWT access token from Supabase auth session'),
    },
    async ({ token }) => {
      try {
        if (token.startsWith('pk_live_')) {
          praxisClient.setApiKey(token);
          return { content: [{ type: 'text', text: 'API key set (X-API-Key header). You are now authenticated.' }] };
        }
        praxisClient.setAuthToken(token);
        return { content: [{ type: 'text', text: 'Auth token set. You are now authenticated for API calls.' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'set_api_key',
    'Set a Praxis API key. Get key from Account Settings → API Keys. Format: pk_live_...',
    {
      key: z.string().min(10).describe('Praxis API key (starts with pk_live_)'),
    },
    async ({ key }) => {
      try {
        praxisClient.setApiKey(key);
        return { content: [{ type: 'text', text: 'API key set. You are now authenticated via X-API-Key header.' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'logout',
    'Clear the stored auth token. Subsequent API calls will be unauthenticated.',
    {},
    async () => {
      try {
        praxisClient.clearAuth();
        return { content: [{ type: 'text', text: 'Logged out. Auth token cleared.' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_auth_status',
    'Check if you are authenticated and get basic auth info.',
    {},
    async () => {
      try {
        const token = praxisClient.getAuthToken();
        const apiKey = (praxisClient as any).client?.defaults?.headers?.['X-API-Key'];
        const hasApiKey = !!apiKey || !!process.env.PRAXIS_API_KEY;
        const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              authenticated: !!token || !!apiKey,
              hasApiKey,
              hasSupabase,
              authMethod: apiKey ? 'api_key' : token ? 'bearer_token' : process.env.PRAXIS_API_KEY ? 'api_key' : 'none',
            }, null, 2),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== USER TOOLS ====================
server.tool(
    'get_me',
    'Get the current user profile',
    {},
    async () => {
      try {
        const res = await praxisClient.getMe();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_user',
    'Get another user\'s public profile',
    {
      userId: z.string().describe('User ID to lookup'),
    },
    async ({ userId }) => {
      try {
        const res = await praxisClient.getUser(userId);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_leaderboard',
    'Get the points leaderboard',
    {},
    async () => {
      try {
        const res = await praxisClient.getLeaderboard();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'update_profile',
    'Update the current user profile',
    {
      name: z.string().optional().describe('Display name'),
      bio: z.string().optional().describe('Bio'),
      city: z.string().optional().describe('City'),
    },
    async (args) => {
      try {
        const res = await praxisClient.getMe();
        const userId = res.user?.id;
        await praxisClient.updateUser(userId, args);
        return { content: [{ type: 'text', text: 'Profile updated' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== GOAL TOOLS ====================
  server.tool(
    'get_goals',
    'Get all goals for the current user',
    {},
    async () => {
      try {
        const me = await praxisClient.getMe();
        const userId = me.user?.id || me.id;
        if (!userId) throw new Error('Could not get current user ID');
        const res = await praxisClient.getGoalTree(userId);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_user_goals',
    'Get goals for a specific user',
    {
      userId: z.string().describe('User ID'),
    },
    async ({ userId }) => {
      try {
        const res = await praxisClient.getGoals(userId);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_goal',
    'Create a new goal',
    {
      name: z.string().min(1).describe('Goal name'),
      description: z.string().optional().describe('Goal description'),
      target: z.number().optional().describe('Target value (e.g., 100 days)'),
    },
    async ({ name, description, target }) => {
      try {
        const res = await praxisClient.createGoal({ name, description, target });
        return { content: [{ type: 'text', text: 'Created goal: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

server.tool(
    'delete_goal',
    'Delete a goal',
    {
      goalId: z.string().describe('Goal ID'),
    },
    async ({ goalId }) => {
      try {
        const res = await praxisClient.deleteGoal(goalId);
        return { content: [{ type: 'text', text: 'Goal deleted: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_goal_node',
    'Get a specific goal node',
    {
      goalId: z.string().describe('Goal ID'),
      nodeId: z.string().describe('Node ID'),
    },
    async ({ goalId, nodeId }) => {
      try {
        const res = await praxisClient.getGoalNode(goalId, nodeId);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

server.tool(
    'create_goal_node',
    'Create a child node under a goal',
    {
      goalId: z.string().describe('Goal ID'),
      name: z.string().describe('Node name'),
      description: z.string().optional().describe('Node description'),
      parentNodeId: z.string().optional().describe('Parent node ID'),
    },
    async ({ goalId, name, description, parentNodeId }) => {
      try {
        const res = await praxisClient.createGoalNode(goalId, { name, description, parentId: parentNodeId });
        return { content: [{ type: 'text', text: 'Created goal node: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'update_progress',
    'Update progress on a goal node',
    {
      goalId: z.string().describe('Goal ID'),
      nodeId: z.string().describe('Node ID'),
      progress: z.number().min(0).describe('Progress value'),
      note: z.string().optional().describe('Progress note'),
    },
    async ({ goalId, nodeId, progress, note }) => {
      try {
        const me = await praxisClient.getMe();
        const userId = me.user?.id || me.id;
        if (!userId) throw new Error('Could not get current user ID');
        await praxisClient.updateNodeProgress(userId, nodeId, progress, note);
        return { content: [{ type: 'text', text: 'Progress updated' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== CHECK-IN TOOLS ====================
  server.tool(
    'get_today_checkin',
    'Get today\'s check-in',
    {},
    async () => {
      try {
        const res = await praxisClient.getTodayCheckIn();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_checkin',
    'Create a daily check-in',
    {
      mood: z.number().min(1).max(10).optional().describe('Mood (1-10)'),
      notes: z.string().optional().describe('Notes'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
    async (args) => {
      try {
        const me = await praxisClient.getMe();
        const userId = me.user?.id || me.id;
        if (!userId) throw new Error('Could not get current user ID');
        const checkinData = {
          mood: args.mood?.toString(),
          winOfTheDay: args.notes,
        };
        const res = await praxisClient.createCheckIn(userId, checkinData);
        return { content: [{ type: 'text', text: 'Check-in created: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_checkin_history',
    'Get check-in history',
    {
      days: z.number().min(1).max(90).default(7).describe('Number of days'),
    },
    async ({ days }) => {
      try {
        const res = await praxisClient.getCheckInHistory(days);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== NOTEBOOK TOOLS ====================
server.tool(
    'get_notebook',
    'Get notebook entries',
    {
      limit: z.number().default(20).describe('Max entries'),
    },
    async ({ limit }) => {
      try {
        const res = await praxisClient.getNotebookEntries({ limit });
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_notebook_entry',
    'Create a notebook entry',
    {
      content: z.string().describe('Entry content'),
      nodeId: z.string().optional().describe('Associated goal node ID'),
    },
    async ({ content, nodeId }) => {
      try {
        const res = await praxisClient.createNotebookEntry({ content, goal_id: nodeId });
        return { content: [{ type: 'text', text: 'Entry created: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'update_notebook_entry',
    'Update a notebook entry',
    {
      entryId: z.string().describe('Entry ID'),
      content: z.string().describe('New content'),
    },
    async ({ entryId, content }) => {
      try {
        const res = await praxisClient.updateNotebookEntry(entryId, { content });
        return { content: [{ type: 'text', text: 'Entry updated: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'delete_notebook_entry',
    'Delete a notebook entry',
    {
      entryId: z.string().describe('Entry ID'),
    },
    async ({ entryId }) => {
      try {
        const res = await praxisClient.deleteNotebookEntry(entryId);
        return { content: [{ type: 'text', text: 'Entry deleted: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'search_notebook',
    'Search notebook entries',
    {
      query: z.string().describe('Search query'),
    },
    async ({ query }) => {
      try {
        const res = await praxisClient.searchNotebook(query);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== DIARY TOOLS ====================
server.tool(
    'get_diary',
    'Get diary entries',
    {
      date: z.string().optional().describe('Date (YYYY-MM-DD)'),
    },
    async ({ date }) => {
      try {
        const res = await praxisClient.getDiary(date);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

server.tool(
    'create_diary_entry',
    'Create a diary entry',
    {
      content: z.string().describe('Diary content'),
      mood: z.number().optional().describe('Mood (1-10)'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
    async ({ content, mood, tags }) => {
      try {
        const res = await praxisClient.createDiaryEntry({ content, mood, tags });
        return { content: [{ type: 'text', text: 'Diary entry created: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== MESSAGE TOOLS ====================
  server.tool(
    'get_conversations',
    'Get all conversations',
    {},
    async () => {
      try {
        const res = await praxisClient.getConversations();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

server.tool(
    'get_messages',
    'Get messages with a user',
    {
      userId: z.string().describe('Other user ID'),
      limit: z.number().default(50).describe('Max messages'),
    },
    async ({ userId, limit }) => {
      try {
        const res = await praxisClient.getMessages(userId, limit);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'send_message',
    'Send a message to a buddy',
    {
      receiverId: z.string().describe('Receiver user ID'),
      content: z.string().describe('Message content'),
    },
    async ({ receiverId, content }) => {
      try {
        const res = await praxisClient.sendMessage(receiverId, content);
        return { content: [{ type: 'text', text: 'Message sent: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'mark_messages_read',
    'Mark messages as read',
    {
      userId: z.string().describe('User ID to mark as read'),
    },
    async ({ userId }) => {
      try {
        const res = await praxisClient.markMessagesRead(userId);
        return { content: [{ type: 'text', text: 'Messages marked as read: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== AXIOM (AI) TOOLS ====================
  server.tool(
    'get_daily_brief',
    'Get the daily Axiom AI brief',
    {},
    async () => {
      try {
        const res = await praxisClient.getDailyBrief();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

server.tool(
    'regenerate_brief',
    'Regenerate the daily Axiom brief',
    {},
    async () => {
      try {
        const res = await praxisClient.regenerateBrief();
        return { content: [{ type: 'text', text: 'Brief regenerated: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'chat_with_axiom',
    'Chat with the Axiom AI assistant',
    {
      message: z.string().describe('Your message'),
      context: z.string().optional().describe('Additional context'),
    },
    async ({ message, context }) => {
      try {
        const res = await praxisClient.chatWithAxiom(message, context);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== GAMIFICATION TOOLS ====================
server.tool(
    'get_profile_stats',
    'Get the current user profile stats',
    {},
    async () => {
      try {
        const res = await praxisClient.getProfileStats();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

server.tool(
    'get_achievements',
    'Get the current user\'s achievements',
    {},
    async () => {
      try {
        const res = await praxisClient.getAchievements();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
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
        const res = await praxisClient.getStreak();
        return { content: [{ type: 'text', text: 'Current streak: ' + (res.current_streak || 0) + ' days' }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_quests',
    'Get available quests',
    {},
    async () => {
      try {
        const res = await praxisClient.getQuests();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== BET TOOLS ====================
server.tool(
    'get_bets',
    'Get all bets',
    {},
    async () => {
      try {
        const res = await praxisClient.getBets();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_bet',
    'Create a new bet',
    {
      title: z.string().describe('Bet title'),
      amount: z.number().describe('Bet amount (points)'),
      deadline: z.string().describe('Deadline (YYYY-MM-DD)'),
    },
    async ({ title, amount, deadline }) => {
      try {
        const res = await praxisClient.createBet({ title, amount, deadline });
        return { content: [{ type: 'text', text: 'Bet created: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'resolve_bet',
    'Resolve a bet',
    {
      betId: z.string().describe('Bet ID'),
      won: z.boolean().describe('Whether you won'),
    },
    async ({ betId, won }) => {
      try {
        const res = await praxisClient.resolveBet(betId, won);
        return { content: [{ type: 'text', text: 'Bet resolved: ' + (won ? 'Won' : 'Lost') + ' ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== DUEL TOOLS ====================
  server.tool(
    'get_duels',
    'Get all duels',
    {},
    async () => {
      try {
        const res = await praxisClient.getDuels();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_duel',
    'Challenge someone to a duel',
    {
      opponentId: z.string().describe('Opponent user ID'),
      goalId: z.string().describe('Goal ID to duel on'),
    },
    async ({ opponentId, goalId }) => {
      try {
        const res = await praxisClient.createDuel({ opponent_id: opponentId, goal_id: goalId });
        return { content: [{ type: 'text', text: 'Duel created: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'accept_duel',
    'Accept a duel',
    {
      duelId: z.string().describe('Duel ID'),
    },
    async ({ duelId }) => {
      try {
        const res = await praxisClient.acceptDuel(duelId);
        return { content: [{ type: 'text', text: 'Duel accepted: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'resolve_duel',
    'Resolve a duel',
    {
      duelId: z.string().describe('Duel ID'),
      winnerId: z.string().describe('Winner user ID'),
    },
    async ({ duelId, winnerId }) => {
      try {
        const res = await praxisClient.resolveDuel(duelId, winnerId);
        return { content: [{ type: 'text', text: 'Duel resolved: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== CALENDAR TOOLS ====================
server.tool(
    'get_calendar_events',
    'Get calendar events',
    {
      start: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      end: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    async ({ start, end }) => {
      try {
        const res = await praxisClient.getCalendarEvents(start, end);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_calendar_event',
    'Create a calendar event',
    {
      title: z.string().describe('Event title'),
      startTime: z.string().describe('Start time (ISO 8601)'),
      endTime: z.string().optional().describe('End time (ISO 8601)'),
      description: z.string().optional().describe('Event description'),
    },
    async ({ title, startTime, endTime, description }) => {
      try {
        const res = await praxisClient.createCalendarEvent({ title, start_time: startTime, end_time: endTime, description });
        return { content: [{ type: 'text', text: 'Event created: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_google_calendar_status',
    'Check Google Calendar connection status',
    {},
    async () => {
      try {
        const res = await praxisClient.getGoogleStatus();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== TRACKER TOOLS ====================
server.tool(
    'get_trackers',
    'Get all trackers',
    {},
    async () => {
      try {
        const res = await praxisClient.getTrackers();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'create_tracker',
    'Create a new tracker',
    {
      name: z.string().describe('Tracker name'),
      nodeId: z.string().optional().describe('Associated goal node ID'),
    },
    async ({ name, nodeId }) => {
      try {
        const res = await praxisClient.createTracker({ name, goal_id: nodeId });
        return { content: [{ type: 'text', text: 'Tracker created: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'log_tracker_progress',
    'Log progress on a tracker',
    {
      trackerId: z.string().describe('Tracker ID'),
      value: z.number().describe('Progress value'),
    },
    async ({ trackerId, value }) => {
      try {
        const res = await praxisClient.logTrackerProgress(trackerId, value);
        return { content: [{ type: 'text', text: 'Progress logged: ' + value + ' ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_tracker_calendar',
    'Get tracker calendar view',
    {
      trackerId: z.string().describe('Tracker ID'),
      month: z.string().describe('Month (YYYY-MM)'),
    },
    async ({ trackerId, month }) => {
      try {
        const res = await praxisClient.getTrackerCalendar(trackerId, month);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== BUDDY TOOLS ====================
server.tool(
    'get_buddies',
    'Get your buddies',
    {},
    async () => {
      try {
        const res = await praxisClient.getBuddies();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'find_buddies',
    'Find potential buddies',
    {},
    async () => {
      try {
        const res = await praxisClient.findMatches();
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'add_buddy',
    'Add a buddy',
    {
      buddyId: z.string().describe('Buddy user ID'),
    },
    async ({ buddyId }) => {
      try {
        const res = await praxisClient.addBuddy(buddyId);
        return { content: [{ type: 'text', text: 'Buddy added: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'remove_buddy',
    'Remove a buddy',
    {
      buddyId: z.string().describe('Buddy user ID'),
    },
    async ({ buddyId }) => {
      try {
        const res = await praxisClient.removeBuddy(buddyId);
        return { content: [{ type: 'text', text: 'Buddy removed: ' + JSON.stringify(res, null, 2) }] };
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
        const res = await praxisClient.getPoints();
        return { content: [{ type: 'text', text: 'Points: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'get_points_history',
    'Get points history',
    {
      days: z.number().min(1).max(365).default(30).describe('Number of days'),
    },
    async ({ days }) => {
      try {
        const res = await praxisClient.getPointsHistory(days);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== SEARCH TOOLS ====================
  server.tool(
    'search',
    'Search across goals, notebook, and users',
    {
      query: z.string().describe('Search query'),
    },
    async ({ query }) => {
      try {
        const res = await praxisClient.search(query);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== ANALYTICS TOOLS ====================
  server.tool(
    'get_analytics',
    'Get usage analytics',
    {
      period: z.string().default('30d').describe('Period (7d, 30d, 90d, 1y)'),
    },
    async ({ period }) => {
      try {
        const res = await praxisClient.getAnalytics(period);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== NOTIFICATION TOOLS ====================
server.tool(
    'get_notifications',
    'Get notifications',
    {
      limit: z.number().default(20).describe('Number of notifications'),
    },
    async ({ limit }) => {
      try {
        const res = await praxisClient.getNotifications(limit);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  server.tool(
    'mark_notification_read',
    'Mark notification as read',
    {
      notificationId: z.string().describe('Notification ID'),
    },
    async ({ notificationId }) => {
      try {
        const res = await praxisClient.markNotificationRead(notificationId);
        return { content: [{ type: 'text', text: 'Notification marked as read: ' + JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  // ==================== AI COACHING TOOLS ====================
  server.tool(
    'get_coaching_advice',
    'Get AI coaching advice for a goal',
    {
      goalId: z.string().describe('Goal ID'),
    },
    async ({ goalId }) => {
      try {
        const res = await praxisClient.getCoachingAdvice(goalId);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      }
    }
  );

  return server;
}