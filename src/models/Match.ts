export interface Match {
  userId: string;
  score: number;
  textAffinity?: number;
  sharedGoals: string[];
}
