import { Domain } from './Domain';

export interface Group {
  id: string;
  name: string;
  description?: string;
  domain?: Domain; // ✅ Domain from Domain.ts
  goalFilter?: string[]; // ✅ Optional filtered goals
  isDomainSpecific: boolean; // ✅ Flag for domain-specific groups
  createdBy: string;
  maxMembers?: number;
  rules?: GroupRule[];
  features?: string[];
}
export interface GroupRule {
  name: string;
  type: 'budget' | 'workout' | 'communication' | 'study' | 'other';
  configured: boolean;
}

// New enum for domain-specific rule types
export enum DomainRuleType { budget = 'budget', workout = 'workout', communication = 'communication', study = 'study', other = 'other' }