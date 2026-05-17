import { Domain } from './Domain';

export interface ReflectionTrainingData {
  id: string;
  user_id: string;
  goal_id: string;
  domain: Domain;
  action: string;          // what the user did
  statedCause: string;     // why they think it happened (from diary)
  context: {               // situational factors
    mood: string;
    timeOfDay: string;
    streakDay: number;
    externalFactors?: string[];
  };
  outcome: 'success' | 'partial' | 'failure';
  consentLevel: 'anonymized' | 'aggregated' | 'full';
  createdAt: string;
}