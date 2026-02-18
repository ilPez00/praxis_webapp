export interface AchievementVote {
  id: string;
  achievementId: string;
  userId: string;
  type: 'upvote' | 'downvote';
  createdAt: Date;
}