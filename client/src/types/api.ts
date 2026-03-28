// Shared API response types — eliminates duplicate interface definitions across features

/** A post in the community feed or board */
export interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  user_level?: number; // Gamification level
  title: string | null;
  content: string;
  media_url: string | null;
  media_type: string | null;
  context: string;
  reference: Record<string, any> | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  user_liked: boolean;
}

/** A comment on a post */
export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  content: string;
  created_at: string;
}

/** A user profile from the profiles table */
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar_url: string | null;
  username: string | null;
  bio: string | null;
  is_premium: boolean;
  is_admin: boolean;
  is_verified: boolean;
  onboarding_completed: boolean;
  current_streak: number;
  praxis_points: number;
  reliability_score: number;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

/** A check-in record */
export interface CheckIn {
  id: string;
  user_id: string;
  date: string;
  notes: string | null;
  mood: string | null;
  created_at: string;
}

/** A chat message (DM or group) */
export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  room_id: string | null;
  content: string;
  media_url: string | null;
  media_type: string | null;
  message_type: string;
  metadata: Record<string, any> | null;
  created_at: string;
  sender_name?: string;
  sender_avatar_url?: string;
}

/** A group/board room */
export interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  type: 'group' | 'board';
  created_by: string;
  created_at: string;
  member_count?: number;
}

/** A service listing */
export interface Service {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  description: string;
  type: 'offer' | 'request';
  price_currency: string | null;
  tags: string[];
  created_at: string;
}

/** An event */
export interface AppEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  created_by: string;
  created_at: string;
}
