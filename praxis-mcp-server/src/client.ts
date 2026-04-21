import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.PRAXIS_API_URL || 'https://web-production-646a4.up.railway.app/api';
const API_KEY = process.env.PRAXIS_API_KEY;

class PraxisClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
    });
  }

  setApiKey(key: string) {
    this.client.defaults.headers['X-API-Key'] = key;
  }

  private async request<T>(method: string, path: string, data?: any): Promise<T> {
    try {
      const res = await this.client.request({ method, url: path, data });
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
  async delete<T>(path: string): Promise<T> { return this.request<T>('DELETE', path); }

  // Auth
  async login(email: string, password: string) { return this.post<{ user: { id: string } }>('/auth/login', { email, password }); }
  async signup(email: string, password: string, name: string, age: number, bio: string) { return this.post<{ message: string }>('/auth/signup', { email, password, name, age, bio }); }

  // Users
  async getMe() { return this.get<{ user: any }>('/users/me'); }
  async getUser(userId: string) { return this.get<{ user: any }>('/users/' + userId); }
  async getLeaderboard() { return this.get<{ leaderboard: any[] }>('/users/leaderboard'); }
  async updateUser(userId: string, data: any) { return this.put('/users/' + userId, data); }

  // Goals (goal_trees with JSONB nodes)
  async getGoals(userId?: string) { return this.get<{ nodes: any[] }>('/goals/' + (userId || '')); }
  async createGoal(data: any) { return this.post<{ nodes: any[] }>('/goals/', data); }
  async deleteGoal(goalId: string) { return this.delete('/goals/' + goalId); }
  async getGoalNode(goalId: string, nodeId: string) { return this.get<{ node: any }>('/goals/' + goalId + '/node/' + nodeId); }
  async createGoalNode(goalId: string, data: any) { return this.post('/goals/' + goalId + '/node', data); }
  async updateProgress(goalId: string, nodeId: string, progress: number, note?: string) { return this.post('/goals/' + goalId + '/node/' + nodeId + '/progress', { progress, note }); }

  // Check-ins
  async getTodayCheckIn() { return this.get<{ checkin: any }>('/checkins/today?userId=me'); }
  async createCheckIn(data: { mood?: number; notes?: string; tags?: string[] }) { return this.post<{ checkin: any }>('/checkins', data); }
  async getCheckInHistory(days = 7) { return this.get<{ checkins: any[] }>('/checkins?days=' + days); }
  async getCheckIns() { return this.get<any[]>('/checkins'); }

  // Notebook
  async getNotebookEntries(limit = 20) { return this.get<any[]>('/notebook/entries?limit=' + limit); }
  async createNotebookEntry(data: any) { return this.post<any>('/notebook/entries', data); }
  async updateNotebookEntry(entryId: string, data: any) { return this.put('/notebook/entries/' + entryId, data); }
  async deleteNotebookEntry(entryId: string) { return this.delete('/notebook/entries/' + entryId); }
  async searchNotebook(query: string) { return this.get<any[]>('/notebook/entries?search=' + query); }

  // Diary
  async getDiary(date?: string) { return this.get<any[]>('/diary/entries?date=' + (date || new Date().toISOString().slice(0, 10))); }
  async createDiaryEntry(data: any) { return this.post('/diary/entries', data); }

  // Messages
  async getConversations() { return this.get<{ conversations: any[] }>('/messages'); }
  async getMessages(userId: string, limit = 50) { return this.get<{ messages: any[] }>('/messages/' + userId + '?limit=' + limit); }
  async sendMessage(receiverId: string, content: string) { return this.post<{ message: any }>('/messages', { receiver_id: receiverId, content }); }
  async markMessagesRead(userId: string) { return this.put('/messages/' + userId + '/read', {}); }

  // Axiom (AI)
  async getDailyBrief() { return this.get<{ brief: any }>('/axiom/daily-brief'); }
  async regenerateBrief() { return this.post<{ brief: any }>('/axiom/regenerate'); }
  async chatWithAxiom(message: string, context?: string) { return this.post<{ response: any }>('/axiom/agent', { query: message, allow_web_search: !!context }); }

  // Gamification
  async getProfileStats() { return this.get<{ stats: any }>('/gamification/profile'); }
  async getAchievements() { return this.get<{ achievements: any[] }>('/gamification/achievements'); }
  async getStreak() { return this.get<{ current_streak: number }>('/gamification/profile'); }
  async getQuests() { return this.get<{ quests: any[] }>('/gamification/quests'); }

  // Bets
  async getBets() { return this.get<{ bets: any[] }>('/bets'); }
  async createBet(data: any) { return this.post<{ bet: any }>('/bets', data); }
  async resolveBet(betId: string, won: boolean) { return this.post('/bets/' + betId + '/resolve', { won }); }

  // Duels
  async getDuels() { return this.get<{ duels: any[] }>('/duels'); }
  async createDuel(data: any) { return this.post<{ duel: any }>('/duels', data); }
  async acceptDuel(duelId: string) { return this.post('/duels/' + duelId + '/accept'); }
  async resolveDuel(duelId: string, winnerId: string) { return this.post('/duels/' + duelId + '/resolve', { winner_id: winnerId }); }

  // Calendar
  async getCalendarEvents(start?: string, end?: string) { return this.get<{ events: any[] }>('/calendar/google/events?start=' + (start || '') + '&end=' + (end || '')); }
  async createCalendarEvent(data: any) { return this.post('/calendar/google/events', data); }
  async getGoogleStatus() { return this.get<{ connected: boolean }>('/calendar/google/status'); }

  // Trackers
  async getTrackers() { return this.get<{ trackers: any[] }>('/trackers/my'); }
  async createTracker(data: any) { return this.post<{ tracker: any }>('/trackers', data); }
  async logTrackerProgress(trackerId: string, value: number) { return this.post('/trackers/' + trackerId + '/log', { value }); }
  async getTrackerCalendar(trackerId: string, month: string) { return this.get<{ calendar: any[] }>('/trackers/' + trackerId + '/calendar?month=' + month); }

  // Buddies
  async getBuddies() { return this.get<{ buddies: any[] }>('/buddies'); }
  async findMatches() { return this.get<{ matches: any[] }>('/buddies/matches'); }
  async addBuddy(buddyId: string) { return this.post('/buddies', { buddy_id: buddyId }); }
  async removeBuddy(buddyId: string) { return this.delete('/buddies/' + buddyId); }

  // Points
  async getPoints() { return this.get<{ balance: number }>('/points/balance'); }
  async getPointsHistory(days = 30) { return this.get<{ history: any[] }>('/points/history?days=' + days); }

  // Search
  async search(query: string) { return this.get<{ results: any[] }>('/search?q=' + query); }

  // Analytics
  async getAnalytics(period = '30d') { return this.get<{ analytics: any }>('/analytics?period=' + period); }

  // Notifications
  async getNotifications(limit = 20) { return this.get<{ notifications: any[] }>('/notifications?limit=' + limit); }
  async markNotificationRead(notifId: string) { return this.post('/notifications/read', { id: notifId }); }

  // AI Coaching
  async getCoachingAdvice(goalId: string) { return this.get<{ advice: any }>('/ai-coaching/advice/' + goalId); }
}

export const praxisClient = new PraxisClient();
export default praxisClient;