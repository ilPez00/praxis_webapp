export type FieldType = 'text' | 'number' | 'select' | 'date';

export interface TrackerField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];    // for select fields
  optional?: boolean;
}

export interface TrackerType {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  fields: TrackerField[];
  entryLabel: (data: Record<string, string>) => string;
}

import { Domain } from '../../models/Domain';

export const TRACKER_TYPES: TrackerType[] = [
  {
    id: 'lift',
    label: 'Lift Tracker',
    icon: '🏋️',
    description: 'Log strength training sets, reps, and weight',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    fields: [
      { key: 'exercise', label: 'Exercise', type: 'text', placeholder: 'e.g. Bench Press' },
      { key: 'sets', label: 'Sets', type: 'number', placeholder: '3' },
      { key: 'reps', label: 'Reps', type: 'number', placeholder: '8' },
      { key: 'weight', label: 'Weight (kg)', type: 'number', placeholder: '80' },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'e.g. felt strong', optional: true },
    ],
    entryLabel: d => `${d.exercise || '?'}: ${d.sets}×${d.reps} @ ${d.weight}kg`,
  },
  {
    id: 'meal',
    label: 'Meal Tracker',
    icon: '🥗',
    description: 'Track meals, portions, and calories',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    fields: [
      { key: 'meal', label: 'Meal', type: 'select', options: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
      { key: 'food', label: 'What did you eat?', type: 'text', placeholder: 'e.g. Grilled chicken & rice' },
      { key: 'calories', label: 'Calories (approx)', type: 'number', placeholder: '500', optional: true },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.meal || 'Meal'}: ${d.food || '?'}${d.calories ? ` · ${d.calories} kcal` : ''}`,
  },
  {
    id: 'hangout',
    label: 'Hangout Planner',
    icon: '👥',
    description: 'Plan and log social activities',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    fields: [
      { key: 'person', label: 'With whom?', type: 'text', placeholder: 'e.g. Alex, my team' },
      { key: 'activity', label: 'Activity', type: 'text', placeholder: 'e.g. Coffee, gym, dinner' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['Planned', 'Done', 'Cancelled'] },
    ],
    entryLabel: d => `${d.activity || '?'} with ${d.person || '?'} — ${d.status || 'Planned'}`,
  },
  {
    id: 'cardio',
    label: 'Cardio Tracker',
    icon: '🏃',
    description: 'Log runs, cycles, and cardio sessions',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    fields: [
      { key: 'activity', label: 'Activity', type: 'select', options: ['Running', 'Cycling', 'Swimming', 'HIIT', 'Walking', 'Other'] },
      { key: 'duration', label: 'Duration (min)', type: 'number', placeholder: '30' },
      { key: 'distance', label: 'Distance (km)', type: 'number', placeholder: '5', optional: true },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.activity || '?'} · ${d.duration}min${d.distance ? ` / ${d.distance}km` : ''}`,
  },
  {
    id: 'steps',
    label: 'Step Counter',
    icon: '👟',
    description: 'Track daily steps toward your activity goal',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.25)',
    fields: [
      { key: 'steps', label: 'Steps', type: 'number', placeholder: '10000' },
      { key: 'goal', label: 'Daily Goal', type: 'number', placeholder: '10000', optional: true },
      { key: 'source', label: 'Source', type: 'select', options: ['Manual', 'Apple Health', 'Garmin', 'Fitbit', 'Google Fit'], optional: true },
    ],
    entryLabel: (d) => `${Number(d.steps).toLocaleString()} steps${d.goal ? ` / ${Number(d.goal).toLocaleString()} goal` : ''}`,
  },
  {
    id: 'study',
    label: 'Study Tracker',
    icon: '📚',
    description: 'Track study sessions and learning progress',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    fields: [
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g. Python, Marketing' },
      { key: 'duration', label: 'Duration (min)', type: 'number', placeholder: '60' },
      { key: 'topic', label: 'Topic covered', type: 'text', placeholder: 'e.g. Chapter 3' },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.subject || '?'}: ${d.topic || '?'} (${d.duration}min)`,
  },
  {
    id: 'sleep',
    label: 'Sleep Tracker',
    icon: '🛌',
    description: 'Log sleep duration and quality',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
    fields: [
      { key: 'duration', label: 'Hours slept', type: 'number', placeholder: '8' },
      { key: 'quality', label: 'Quality', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.duration}h · ${d.quality || '?'}`,
  },
  {
    id: 'meditation',
    label: 'Meditation',
    icon: '🧘',
    description: 'Track mindfulness and meditation sessions',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
    fields: [
      { key: 'duration', label: 'Duration (min)', type: 'number', placeholder: '15' },
      { key: 'type', label: 'Type', type: 'select', options: ['Guided', 'Breathing', 'Visualisation', 'Body Scan', 'Free'] },
      { key: 'feeling', label: 'Feeling after', type: 'select', options: ['Calm', 'Energised', 'Focused', 'Neutral', 'Tired'] },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.duration}min ${d.type || '?'} · ${d.feeling || '?'}`,
  },
  {
    id: 'budget',
    label: 'Budget Tracker',
    icon: '💰',
    description: 'Track expenses, income, and savings',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.2)',
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['Expense', 'Income', 'Saving'] },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Food, Transport' },
      { key: 'amount', label: 'Amount (€)', type: 'number', placeholder: '50' },
      { key: 'description', label: 'Description', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.type || '?'}: ${d.category || '?'} · €${d.amount || '?'}`,
  },
  {
    id: 'adventure',
    label: 'Adventure Tracker',
    icon: '🏔️',
    description: 'Log bucket-list goals, milestones, and life experiences',
    color: '#F43F5E',
    bg: 'rgba(244,63,94,0.08)',
    border: 'rgba(244,63,94,0.25)',
    fields: [
      { key: 'goal', label: 'Experience / Goal', type: 'text', placeholder: 'e.g. Climb Mt. Fuji' },
      { key: 'status', label: 'Status', type: 'select', options: ['Planned', 'In Progress', 'Completed'] },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. Japan', optional: true },
      { key: 'date', label: 'Target / Completed Date', type: 'date', optional: true },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'How did it feel?', optional: true },
    ],
    entryLabel: d => `${d.goal || '?'} — ${d.status || 'Planned'}${d.location ? ` · ${d.location}` : ''}`,
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: '📓',
    description: 'Daily reflections, mood tracking, and gratitude entries',
    color: '#14B8A6',
    bg: 'rgba(20,184,166,0.08)',
    border: 'rgba(20,184,166,0.25)',
    fields: [
      { key: 'mood', label: 'Mood', type: 'select', options: ['Great', 'Good', 'Okay', 'Low', 'Rough'] },
      { key: 'entry', label: 'What happened / how do you feel?', type: 'text', placeholder: 'Write anything…' },
      { key: 'gratitude', label: 'Grateful for…', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.mood || '?'}: ${(d.entry || '').slice(0, 40)}${(d.entry || '').length > 40 ? '…' : ''}`,
  },
  {
    id: 'project',
    label: 'Creative Project',
    icon: '🎨',
    description: 'Track time and milestones on hobbies and creative work',
    color: '#A855F7',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.25)',
    fields: [
      { key: 'project', label: 'Project Name', type: 'text', placeholder: 'e.g. Oil Painting Series' },
      { key: 'time_spent', label: 'Time Spent (min)', type: 'number', placeholder: '60' },
      { key: 'milestone', label: 'What did you accomplish?', type: 'text', placeholder: 'e.g. Finished underpainting' },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.project || '?'}: ${d.milestone || '?'} (${d.time_spent}min)`,
  },
  {
    id: 'job-apps',
    label: 'Job Applications',
    icon: '💼',
    description: 'Track job applications, interviews, and career moves',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    fields: [
      { key: 'role', label: 'Role', type: 'text', placeholder: 'e.g. Software Engineer' },
      { key: 'company', label: 'Company', type: 'text', placeholder: 'e.g. Google' },
      { key: 'status', label: 'Status', type: 'select', options: ['Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn'] },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => `${d.role || '?'} @ ${d.company || '?'} — ${d.status || '?'}`,
  },
];

export const TRACKER_MAP: Record<string, TrackerType> = Object.fromEntries(
  TRACKER_TYPES.map(t => [t.id, t])
);

/**
 * Maps each goal domain to the tracker IDs that are automatically
 * activated when a user has goals in that domain.
 */
export const DOMAIN_TRACKER_MAP: Record<string, string[]> = {
  [Domain.FITNESS]:                          ['lift', 'cardio', 'meal', 'steps'],
  [Domain.ACADEMICS]:                        ['study'],
  [Domain.MENTAL_HEALTH]:                    ['sleep', 'meditation', 'journal'],
  [Domain.PHILOSOPHICAL_DEVELOPMENT]:        ['meditation', 'journal'],
  [Domain.INVESTING]:                        ['budget'],
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]:     ['hangout'],
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]:    ['hangout'],
  [Domain.CAREER]:                           ['job-apps'],
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: ['project'],
  [Domain.PERSONAL_GOALS]:                   ['adventure'],
};
