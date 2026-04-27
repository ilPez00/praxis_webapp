// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email?: string;
  name?: string;
  is_demo?: boolean;
  is_admin?: boolean;
  is_premium?: boolean;
  onboarding_completed?: boolean;
  banned_until?: string | null;
  role?: string;
  honor_score?: number;
  praxis_points?: number;
  current_streak?: number;
  reliability_score?: number;
  goal_tree_edit_count?: number;
  created_at: string;
}

export interface UserDetail extends AdminUser {
  bio?: string;
  avatar_url?: string;
  username?: string;
  city?: string;
  checkin_count: number;
  post_count: number;
  friend_count: number;
  root_goal_count: number;
  total_node_count: number;
  verification_count: number;
}

export interface AdminGroup {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  is_board?: boolean;
}

export interface AdminStats {
  totalUsers: number;
  totalGoalTrees: number;
  totalPoints: number;
  avgStreak: number;
  premiumCount: number;
  activeToday: number;
  totalChallenges: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  points: number;
  streak: number;
  domains: string[];
}

export interface NetworkEdge {
  source: string;
  target: string;
  sharedDomains: string[];
}

export interface AdminChallenge {
  id: string;
  title: string;
  description?: string;
  domain: string;
  duration_days: number;
  reward_points: number;
  created_at: string;
}

export interface AdminService {
  id: string;
  user_id: string;
  user_name?: string;
  title: string;
  type: string;
  domain?: string;
  price?: number;
  price_currency?: string;
  active: boolean;
  created_at: string;
}

export interface AdminCoach {
  id: string;
  user_id: string;
  bio?: string;
  domains?: string[];
  skills?: string[];
  rating?: number;
  hourly_rate?: number;
  is_available: boolean;
  created_at: string;
}

export type ConfirmAction =
  | { type: 'delete'; user: AdminUser }
  | { type: 'reset'; user: AdminUser }
  | { type: 'ban'; user: AdminUser }
  | { type: 'delete-demo' }
  | { type: 'delete-group'; group: AdminGroup }
  | { type: 'delete-service'; service: AdminService }
  | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const TabPanel: React.FC<{ value: number; index: number; children: React.ReactNode }> = ({ value, index, children }) => {
  // Note: import React in consuming files
  return value === index ? (children as React.ReactElement) : null;
};

export const isBanned = (u: AdminUser) => !!u.banned_until && new Date(u.banned_until) > new Date();

export interface VocabularyStats {
  totalWords: number;
  uniqueWords: number;
  vocabularyRichness: number;
  variationIndex: number;
  topWords: { word: string; count: number }[];
  interestTags: string[];
  targetingScores: Record<string, number>;
  avgMood: number;
  moodVariance: number;
  dominantTone: string;
  positivityRatio: number;
  topAffinityUsers: { userId: string; name: string; textAffinity: number }[];
  avgTextAffinityScore: number;
  mostActiveHour: number;
  writingFrequency: number;
  avgEntryLength: number;
}
