import axios, { AxiosInstance, AxiosError } from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const API_URL = process.env.PRAXIS_API_URL || 'https://web-production-646a4.up.railway.app/api';
const API_KEY = process.env.PRAXIS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

class PraxisClient {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private supabase: SupabaseClient | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
    });

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }

  setApiKey(key: string) {
    this.client.defaults.headers['X-API-Key'] = key;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  clearAuth() {
    this.authToken = null;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  private async getCurrentUserId(): Promise<string> {
    const me = await this.getMe();
    if (!me?.user?.id) {
      throw new Error('Could not get current user ID');
    }
    return me.user.id;
  }

  private async request<T>(method: string, path: string, data?: any): Promise<T> {
    try {
      const headers: Record<string, string> = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      const res = await this.client.request({ method, url: path, data, headers });
      return res.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response) {
        const data = axiosErr.response.data as any;
        throw new Error(data.message || data.error || `API error: ${axiosErr.response.status}`);
      }
      throw new Error(`Network error: ${axiosErr.message}`);
    }
  }

  async get<T>(path: string): Promise<T> { return this.request<T>('GET', path); }
  async post<T>(path: string, data?: any): Promise<T> { return this.request<T>('POST', path, data); }
  async put<T>(path: string, data?: any): Promise<T> { return this.request<T>('PUT', path, data); }
  async patch<T>(path: string, data?: any): Promise<T> { return this.request<T>('PATCH', path, data); }
  async delete<T>(path: string): Promise<T> { return this.request<T>('DELETE', path); }

  // Auth
  async login(email: string, password: string) { return this.post<{ user: { id: string } }>('/auth/login', { email, password }); }
  async signup(email: string, password: string, name: string, age: number, bio: string) { return this.post<{ message: string }>('/auth/signup', { email, password, name, age, bio }); }

  async loginWithSupabase(email: string, password: string) {
    if (!this.supabase) {
      throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY env vars.');
    }
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session?.access_token) throw new Error('No access token received');
    this.setAuthToken(data.session.access_token);
    return {
      user: { id: data.user.id, email: data.user.email },
      accessToken: data.session.access_token,
    };
  }

  async getOAuthUrl(provider: 'google' = 'google') {
    if (!this.supabase) {
      throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY env vars.');
    }
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: 'http://localhost:3456/auth/callback' },
    });
    if (error) throw new Error(error.message);
    return { url: data.url };
  }

  // Users
  async getUser(userId: string) { return this.get<{ id: string; name: string; avatar_url?: string; praxis_points: number; current_streak: number }>('/users/' + userId); }
  async updateUser(userId: string, data: any) { return this.put('/users/' + userId, data); }
  async getLeaderboard() { return this.get<any[]>('/users/leaderboard'); }
  async getPublicStats() { return this.get<any>('/users/stats/public'); }
  async getNearbyUsers() { return this.get<any[]>('/users/nearby'); }
  async exportMyData() { return this.post<any>('/users/me/export'); }
  async deleteMyAccount() { return this.delete('/users/me'); }
  async completeOnboarding() { return this.post<any>('/users/complete-onboarding'); }

  // Goals (goal_trees with JSONB nodes)
  async getGoalTree(userId: string) { return this.get<{ id: string; user_id: string; nodes: any[]; root_nodes?: string[]; domain_proficiency: Record<string, number> }>('/goals/' + userId); }
  async createOrUpdateGoalTree(nodes: any[], rootNodes?: string[]) { return this.post<any>('/goals/', { nodes, root_nodes: rootNodes }); }
  async createGoalNode(userId: string, data: { name: string; description?: string; domain?: string; targetDate?: string; parentId?: string }) { return this.post<{ node: any; newBalance: number }>('/goals/' + userId + '/node', data); }
  async updateGoalNode(userId: string, nodeId: string, data: any) { return this.patch('/goals/' + userId + '/node/' + nodeId, data); }
  async deleteGoalNode(userId: string, nodeId: string) { return this.delete('/goals/' + userId + '/node/' + nodeId); }
  async updateNodeProgress(userId: string, nodeId: string, progress: number, note?: string) { return this.patch('/goals/' + userId + '/node/' + nodeId + '/progress', { progress, note }); }

  // Check-ins
  async getTodayCheckIn() { return this.get<any>('/checkins/today'); }
  async createCheckIn(userId: string, data: { mood?: string; winOfTheDay?: string }) { return this.post<any>('/checkins/', { userId, ...data }); }
  async getMutualStreak() { return this.get<any>('/checkins/mutual'); }

  // Posts
  async getFeed(userId?: string) { return this.get<any[]>('/posts/feed' + (userId ? '?userId=' + userId : '')); }
  async getUserPosts(userId: string) { return this.get<any[]>('/posts/by-user/' + userId); }
  async getAllPosts() { return this.get<any[]>('/posts/'); }
  async getPost(postId: string) { return this.get<any>('/posts/' + postId); }
  async createPost(body: string, context?: string) { return this.post<any>('/posts/', { body, context }); }
  async deletePost(postId: string) { return this.delete('/posts/' + postId); }
  async toggleLike(postId: string) { return this.post<any>('/posts/' + postId + '/likes'); }
  async addComment(postId: string, body: string) { return this.post<any>('/posts/' + postId + '/comments', { body }); }
  async deleteComment(postId: string, commentId: string) { return this.delete('/posts/' + postId + '/comments/' + commentId); }
  async getComments(postId: string) { return this.get<any[]>('/posts/' + postId + '/comments'); }
  async votePost(postId: string) { return this.post<any>('/posts/' + postId + '/vote'); }
  async getPostVote(postId: string) { return this.get<any>('/posts/' + postId + '/vote'); }

  // Notebook
  async getNotebookEntries(params?: { entry_type?: string; domain?: string; tag?: string; search?: string; goal_id?: string; limit?: number; offset?: number }) {
    const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString() : '';
    return this.get<any[]>('/notebook/entries' + qs);
  }
  async createNotebookEntry(data: any) { return this.post<any>('/notebook/entries', data); }
  async updateNotebookEntry(entryId: string, data: any) { return this.patch('/notebook/entries/' + entryId, data); }
  async deleteNotebookEntry(entryId: string) { return this.delete('/notebook/entries/' + entryId); }
  async getNotebookStats() { return this.get<any>('/notebook/stats'); }
  async getNotebookTags() { return this.get<any[]>('/notebook/tags'); }

  // Diary
  async getDiaryEntries(params?: { entry_type?: string; tag?: string; search?: string; limit?: number; offset?: number }) {
    const qs = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString() : '';
    return this.get<any[]>('/diary/entries' + qs);
  }
  async createDiaryEntry(data: any) { return this.post<any>('/diary/entries', data); }
  async updateDiaryEntry(entryId: string, data: any) { return this.patch('/diary/entries/' + entryId, data); }
  async deleteDiaryEntry(entryId: string) { return this.delete('/diary/entries/' + entryId); }
  async getDiaryStats() { return this.get<any>('/diary/stats'); }

  // Messages
  async getConversation(user1Id: string, user2Id: string) { return this.get<{ messages: any[] }>('/messages/' + user1Id + '/' + user2Id); }
  async sendMessage(receiverId: string, content: string) { return this.post<any>('/messages/', { receiver_id: receiverId, content }); }
  async sendMessageAlias(receiverId: string, content: string) { return this.post<any>('/messages/send', { receiver_id: receiverId, content }); }

  // Groups
  async getJoinedRooms() { return this.get<any[]>('/groups/joined'); }
  async listRooms() { return this.get<any[]>('/groups/'); }
  async getRoom(roomId: string) { return this.get<any>('/groups/' + roomId); }
  async createRoom(name: string, description?: string) { return this.post<any>('/groups/', { name, description }); }
  async joinRoom(roomId: string) { return this.post<any>('/groups/' + roomId + '/join'); }
  async leaveRoom(roomId: string) { return this.delete('/groups/' + roomId + '/leave'); }
  async getRoomMessages(roomId: string) { return this.get<any[]>('/groups/' + roomId + '/messages'); }
  async sendRoomMessage(roomId: string, content: string) { return this.post<any>('/groups/' + roomId + '/messages', { content }); }
  async getRoomMembers(roomId: string) { return this.get<any[]>('/groups/' + roomId + '/members'); }

  // Axiom (AI)
  async getDailyBrief() { return this.get<any>('/ai-coaching/brief'); }
  async getDailyBrief2() { return this.get<any>('/ai-coaching/daily-brief'); }
  async regenerateBrief() { return this.post<any>('/axiom/regenerate'); }
  async chatWithAxiom(message: string, context?: string) { return this.post<any>('/axiom/agent', { query: message, allow_web_search: !!context }); }
  async getWeeklyNarrative() { return this.post<any>('/ai-coaching/weekly-narrative'); }
  async requestCoaching(query: string) { return this.post<any>('/ai-coaching/request', { query }); }
  async chatWithCoach(message: string) { return this.post<any>('/ai-coaching/chat', { message }); }

  // Gamification
  async getGamificationProfile() { return this.get<{ profile: any; achievements: any[]; quests: any[]; stats: any }>('/gamification/profile'); }
  async getAchievements() { return this.get<{ achievements: any[] }>('/gamification/achievements'); }
  async getQuests() { return this.get<{ quests: any[] }>('/gamification/quests'); }
  async getLeaderboard2() { return this.get<any[]>('/gamification/leaderboard'); }
  async getTitles() { return this.get<any[]>('/gamification/titles'); }
  async equipTitle(titleId: string) { return this.post<any>('/gamification/titles/equip', { title_id: titleId }); }
  async unequipTitle() { return this.post<any>('/gamification/titles/unequip'); }
  async claimQuestReward(questId: string) { return this.post<any>('/gamification/quests/' + questId + '/claim'); }
  async progressQuest(questType: string) { return this.post<any>('/gamification/quests/' + questType + '/progress'); }

  // Bets
  async getUserBets(userId: string) { return this.get<any[]>('/bets/' + userId); }
  async getBetById(betId: string) { return this.get<any>('/bets/bet/' + betId); }
  async createBet(data: any) { return this.post<any>('/bets/', data); }
  async cancelBet(betId: string) { return this.delete('/bets/' + betId); }

  // Duels
  async listDuels() { return this.get<{ duels: any[] }>('/duels/'); }
  async myDuels() { return this.get<any[]>('/duels/mine'); }
  async createDuel(data: any) { return this.post<any>('/duels/', data); }
  async acceptDuel(duelId: string) { return this.post<any>('/duels/' + duelId + '/accept'); }
  async declineDuel(duelId: string) { return this.post<any>('/duels/' + duelId + '/decline'); }
  async cancelDuel(duelId: string) { return this.post<any>('/duels/' + duelId + '/cancel'); }
  async claimDuel(duelId: string) { return this.post<any>('/duels/' + duelId + '/claim'); }
  async concedeDuel(duelId: string) { return this.post<any>('/duels/' + duelId + '/concede'); }

  // Calendar
  async getCalendarEvents(start?: string, end?: string) {
    const qs = '?' + new URLSearchParams({ ...(start ? { start } : {}), ...(end ? { end } : {}) }).toString();
    return this.get<{ events: any[] }>('/calendar/google/events' + qs);
  }
  async createCalendarEvent(data: any) { return this.post('/calendar/google/events', data); }
  async getGoogleStatus() { return this.get<{ connected: boolean }>('/calendar/google/status'); }
  async disconnectGoogle() { return this.delete('/calendar/google/disconnect'); }

  // Trackers
  async getMyTrackers() { return this.get<{ trackers: any[] }>('/trackers/my'); }
  async logTracker(data: { type: string; value: number; note?: string; date?: string }) { return this.post<any>('/trackers/log', data); }
  async deleteTrackerEntry(entryId: string) { return this.delete('/trackers/entries/' + entryId); }
  async getCalendarData() { return this.get<any>('/trackers/calendar'); }
  async updateObjective(trackerType: string, data: any) { return this.patch('/trackers/' + trackerType + '/objective', data); }

  // Buddies
  async getBuddies() { return this.get<{ buddies: any[] }>('/buddies/'); }
  async getBuddyRequests() { return this.get<any[]>('/buddies/requests'); }
  async getBuddyStats() { return this.get<any>('/buddies/stats'); }
  async sendBuddyRequest(targetUserId: string) { return this.post<any>('/buddies/request', { target_user_id: targetUserId }); }
  async respondToBuddyRequest(requestId: string, accept: boolean) { return this.post<any>('/buddies/requests/' + requestId + '/respond', { accept }); }
  async pauseBuddyPair(pairId: string) { return this.post<any>('/buddies/pairs/' + pairId + '/pause'); }
  async recordBuddyCheckin(pairId: string) { return this.post<any>('/buddies/pairs/' + pairId + '/checkin'); }

  // Points
  async getPointsBalance() { return this.get<{ balance: number }>('/points/balance'); }
  async spendPoints(amount: number, reason: string) { return this.post<any>('/points/spend', { amount, reason }); }
  async getCatalogue() { return this.get<any[]>('/points/catalogue'); }

  // Search
  async search(query: string) { return this.get<{ results: any[] }>('/search?q=' + query); }

  // Dashboard
  async getDashboardSummary() { return this.get<any>('/dashboard/summary'); }

  // Notifications
  async getNotifications(limit = 20) { return this.get<{ notifications: any[] }>('/notifications?limit=' + limit); }
  async getUnreadCount() { return this.get<{ count: number }>('/notifications/unread-count'); }
  async markNotificationRead(notifId: string) { return this.post('/notifications/read', { id: notifId }); }
  async markAllNotificationsRead() { return this.post('/notifications/read-all'); }
  async deleteNotification(notifId: string) { return this.delete('/notifications/' + notifId); }

  // Friends
  async getFriends() { return this.get<any[]>('/friends/'); }
  async getFriendsByUser(userId: string) { return this.get<any[]>('/friends/of/' + userId); }
  async getIncomingFriendRequests() { return this.get<any[]>('/friends/requests/incoming'); }
  async getFriendStatus(targetUserId: string) { return this.get<any>('/friends/status/' + targetUserId); }
  async sendFriendRequest(targetUserId: string) { return this.post<any>('/friends/request/' + targetUserId); }
  async acceptFriendRequest(requestId: string) { return this.post<any>('/friends/accept/' + requestId); }
  async rejectFriendRequest(requestId: string) { return this.delete('/friends/requests/' + requestId); }
  async unfriend(friendId: string) { return this.delete('/friends/' + friendId); }

  // Events
  async getEvents() { return this.get<any[]>('/events/'); }
  async createEvent(data: any) { return this.post<any>('/events/', data); }
  async rsvpEvent(eventId: string, status: string) { return this.post<any>('/events/' + eventId + '/rsvp', { status }); }

  // Challenges
  async listChallenges() { return this.get<any[]>('/challenges/'); }
  async joinChallenge(challengeId: string) { return this.post<any>('/challenges/' + challengeId + '/join'); }
  async leaveChallenge(challengeId: string) { return this.delete('/challenges/' + challengeId + '/leave'); }

  // Weekly Challenge
  async getWeeklyChallenge() { return this.get<any>('/weekly-challenge/'); }
  async claimWeeklyTier(tier: string) { return this.post<any>('/weekly-challenge/claim/' + tier); }

  // Journal
  async getJournalEntries() { return this.get<any[]>('/journal/entries'); }
  async createJournalEntry(content: string) { return this.post<any>('/journal/entries', { content }); }

  // Feedback
  async submitFeedback(type: string, message: string) { return this.post<any>('/feedback/', { type, message }); }

  // Honor
  async getHonor(userId: string) { return this.get<any>('/honor/' + userId); }
  async giveHonor(targetId: string) { return this.post<any>('/honor/' + targetId); }

  // Agent API
  async listAgents() { return this.get<{ agents: any[] }>('/agent/agents'); }
  async listApiKeys() { return this.get<{ keys: any[] }>('/agent/keys'); }
  async createApiKeyDirect(agentId: string) { return this.post<any>('/agent/keys/direct', { agent_id: agentId }); }
  async revokeApiKey(keyId: string) { return this.delete('/agent/keys/' + keyId); }

  // Seasonal Events
  async getActiveEvents() { return this.get<any[]>('/seasonal-events/active'); }
  async getMyEventProgress() { return this.get<any>('/seasonal-events/my-progress'); }

  // Coach / Personality
  async listCoaches() { return this.get<any[]>('/coaches/'); }
  async listPersonalities() { return this.get<any[]>('/coaches/personalities'); }

  // Additional methods for MCP tools compatibility
  async getMe() { return this.get<any>('/users/me'); }
  async getGoals(userId?: string) { 
    if (userId) return this.getGoalTree(userId);
    // Get current user ID
    const currentUserId = await this.getCurrentUserId();
    return this.getGoalTree(currentUserId);
  }
  async createGoal(data: any) { 
    // This likely maps to createOrUpdateGoalTree but needs nodes array
    throw new Error('createGoal not implemented - use createOrUpdateGoalTree or createGoalNode');
  }
  async deleteGoal(goalId: string) { 
    // Not sure what endpoint this maps to
    throw new Error('deleteGoal not implemented');
  }
  async getGoalNode(goalId: string, nodeId: string) { 
    // Not sure endpoint - maybe /goals/:userId/node/:nodeId
    throw new Error('getGoalNode not implemented - use getGoalTree and find node');
  }
  async updateProgress(goalId: string, nodeId: string, progress: number, note?: string) {
    // Need userId - can't determine from context
    throw new Error('updateProgress not implemented - use updateNodeProgress with userId');
  }
  async getCheckInHistory(days: number) { 
    // Not sure endpoint
    throw new Error('getCheckInHistory not implemented');
  }
  async searchNotebook(query: string) { 
    return this.getNotebookEntries({ search: query });
  }
  async getDiary(date?: string) { 
    return this.getDiaryEntries(date ? { entry_type: date } : {});
  }
  async getConversations() { 
    // Not sure endpoint - maybe /messages/conversations
    throw new Error('getConversations not implemented');
  }
  async getMessages(userId: string, limit: number = 50) { 
    // Need current user ID to call getConversation
    throw new Error('getMessages not implemented - use getConversation with both user IDs');
  }
  async markMessagesRead(userId: string) { 
    throw new Error('markMessagesRead not implemented');
  }
  async getProfileStats() { 
    return this.getGamificationProfile();
  }
  async getStreak() { 
    const me = await this.getMe();
    // Try to extract streak from user object
    const streak = me.current_streak || me.user?.current_streak || 0;
    return { current_streak: streak };
  }
  async getBets() { 
    // Need userId for getUserBets
    throw new Error('getBets not implemented - use getUserBets with userId');
  }
  async resolveBet(betId: string, won: boolean) { 
    throw new Error('resolveBet not implemented');
  }
  async getDuels() { 
    return this.listDuels();
  }
  async resolveDuel(duelId: string, winnerId: string) { 
    throw new Error('resolveDuel not implemented');
  }
  async getTrackers() { 
    return this.getMyTrackers();
  }
  async createTracker(data: any) { 
    throw new Error('createTracker not implemented');
  }
  async logTrackerProgress(trackerId: string, value: number) { 
    // logTracker expects { type, value, note?, date? }
    throw new Error('logTrackerProgress not implemented - use logTracker with type');
  }
  async getTrackerCalendar(trackerId: string, month: string) { 
    throw new Error('getTrackerCalendar not implemented');
  }
  async findMatches() { 
    // Not sure endpoint - maybe /buddies/find
    throw new Error('findMatches not implemented');
  }
  async addBuddy(buddyId: string) { 
    return this.sendBuddyRequest(buddyId);
  }
  async removeBuddy(buddyId: string) { 
    throw new Error('removeBuddy not implemented');
  }
  async getPoints() { 
    return this.getPointsBalance();
  }
  async getPointsHistory(days: number) { 
    throw new Error('getPointsHistory not implemented');
  }
  async getAnalytics(period: string = '30d') { 
    throw new Error('getAnalytics not implemented');
  }
  async getCoachingAdvice(goalId: string) { 
    throw new Error('getCoachingAdvice not implemented');
  }

  // Stripe Payments
  async createCheckoutSession(plan: 'monthly' | 'annual') {
    return this.post<any>('/stripe/create-checkout-session', { interval: plan });
  }
  async createPPCheckout(tier: string, currency: string = 'eur') {
    return this.post<any>('/stripe/create-pp-checkout', { tier, currency });
  }
  async createPortalSession() {
    return this.post<any>('/stripe/create-portal-session', {});
  }
  async verifySession(sessionId: string) {
    return this.get<any>(`/stripe/verify-session?session_id=${sessionId}`);
  }
}

export const praxisClient = new PraxisClient();
export default praxisClient;
