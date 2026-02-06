export interface Match {
  userId: string;
  score: number;
  sharedGoals: string[]; // IDs of shared goals
}
