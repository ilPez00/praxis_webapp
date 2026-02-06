import { User } from './User';
import { Domain } from './Domain';

export interface Match {
  id: string; // Match ID
  otherUser: User; // Details of the matched user
  compatibilityScore: number; // Overall score (0-1)
  sharedGoalDomains: Domain[]; // Domains where goals are shared
  sharedGoals: string[]; // Specific goals that are shared (names or IDs)
  // Potentially more fields like "matchedAt", "lastMessageAt", etc.
}
