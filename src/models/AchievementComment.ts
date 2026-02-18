export interface AchievementComment {
  id: string;
  achievementId: string;
  userId: string;
  userName: string; // Denormalized for display
  userAvatarUrl?: string; // Denormalized for display
  content: string;
  createdAt: Date;
}