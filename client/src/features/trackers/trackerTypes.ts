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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name}: ${i.sets}×${i.reps} @ ${i.weight}kg`).join(', ');
      }
      return `${d.exercise || '?'}: ${d.sets}×${d.reps} @ ${d.weight}kg`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name} (${i.value}${i.unit || 'g'})`).join(', ');
      }
      return `${d.meal || 'Meal'}: ${d.food || '?'}${d.calories ? ` · ${d.calories} kcal` : ''}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name} with ${i.person}`).join(', ');
      }
      return `${d.activity || '?'} with ${d.person || '?'} — ${d.status || 'Planned'}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name}: ${i.duration}min`).join(', ');
      }
      return `${d.activity || '?'} · ${d.duration}min${d.distance ? ` / ${d.distance}km` : ''}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${Number(i.value).toLocaleString()} steps`).join(', ');
      }
      return `${Number(d.steps).toLocaleString()} steps${d.goal ? ` / ${Number(d.goal).toLocaleString()} goal` : ''}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.subject || i.name}: ${i.duration}min`).join(', ');
      }
      return `${d.subject || '?'}: ${d.topic || '?'} (${d.duration}min)`;
    },
  },
  {
    id: 'books',
    label: 'Reading Tracker',
    icon: '📖',
    description: "Track books you're reading with page progress",
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
    fields: [
      { key: 'title', label: 'Book title', type: 'text', placeholder: 'Search a book...' },
      { key: 'author', label: 'Author', type: 'text', placeholder: 'Auto-filled', optional: true },
      { key: 'pages_read', label: 'Pages read today', type: 'number', placeholder: '30' },
      { key: 'total_pages', label: 'Total pages', type: 'number', placeholder: '300', optional: true },
      { key: 'rating', label: 'Rating (1–5)', type: 'number', placeholder: '5', optional: true },
      { key: 'notes', label: 'Notes / Highlights', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: (d: Record<string,any>) => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `"${i.name}" (+${i.pages_read}p)`).join(', ');
      }
      return `"${d.title || '?'}" — ${d.pages_read}p read${d.total_pages ? ` (of ${d.total_pages})` : ''}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.duration}h (${i.quality})`).join(', ');
      }
      return `${d.duration}h · ${d.quality || '?'}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.duration}min ${i.type}`).join(', ');
      }
      return `${d.duration}min ${d.type || '?'} · ${d.feeling || '?'}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.category}: €${i.amount}`).join(', ');
      }
      return `${d.type || '?'}: ${d.category || '?'} · €${d.amount || '?'}`;
    },
  },
  {
    id: 'expenses',
    label: 'Expenses Tracker',
    icon: '💸',
    description: 'Track income and expenses by category with merchant lookup',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['Expense', 'Income', 'Saving', 'Investment'] },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'Groceries' },
      { key: 'merchant', label: 'Merchant / Description', type: 'text', placeholder: 'Lidl', optional: true },
      { key: 'amount', label: 'Amount (€)', type: 'number', placeholder: '45.00' },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name || i.category}: €${i.amount}`).join(', ');
      }
      return `${d.type || '?'}: ${d.category || '?'}${d.merchant ? ` @ ${d.merchant}` : ''} · €${d.amount || '?'}`;
    },
  },
  {
    id: 'investments',
    label: 'Investment Log',
    icon: '📈',
    description: 'Log buy/sell trades and portfolio changes',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    fields: [
      { key: 'action', label: 'Action', type: 'select', options: ['Buy', 'Sell', 'Dividend', 'Rebalance'] },
      { key: 'asset', label: 'Asset (ticker or name)', type: 'text', placeholder: 'AAPL — Apple' },
      { key: 'quantity', label: 'Quantity / Units', type: 'number', placeholder: '10' },
      { key: 'price', label: 'Price per unit (€)', type: 'number', placeholder: '180.00' },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.action} ${i.name}`).join(', ');
      }
      return `${d.action || '?'}: ${d.asset || '?'} · ${d.quantity} × €${d.price}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name} (${i.status})`).join(', ');
      }
      return `${d.goal || '?'} — ${d.status || 'Planned'}${d.location ? ` · ${d.location}` : ''}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => i.name).join('; ');
      }
      return `${d.mood || '?'}: ${(d.entry || '').slice(0, 40)}${(d.entry || '').length > 40 ? '…' : ''}`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name}: ${i.time_spent}min`).join(', ');
      }
      return `${d.project || '?'}: ${d.milestone || '?'} (${d.time_spent}min)`;
    },
  },
  {
    id: 'music',
    label: 'Music Practice',
    icon: '🎵',
    description: 'Track instrument practice sessions and repertoire progress',
    color: '#A855F7',
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.25)',
    fields: [
      { key: 'instrument', label: 'Instrument', type: 'text', placeholder: 'Guitar, Piano…' },
      { key: 'piece', label: 'Piece / Song', type: 'text', placeholder: 'Moonlight Sonata, Wonderwall…' },
      { key: 'duration_min', label: 'Duration (min)', type: 'number', placeholder: '30' },
      { key: 'focus', label: 'Focus area', type: 'select', options: ['Technique', 'Sight-reading', 'Memorisation', 'Expression', 'Repertoire', 'Improvisation', 'Theory'] },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'optional', optional: true },
    ],
    entryLabel: (d: Record<string,any>) => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.instrument}: ${i.name}`).join(', ');
      }
      return `${d.instrument || '?'}: "${d.piece || '?'}" · ${d.duration_min}min [${d.focus || '?'}]`;
    },
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
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name} @ ${i.company}`).join(', ');
      }
      return `${d.role || '?'} @ ${d.company || '?'} — ${d.status || '?'}`;
    },
  },
  {
    id: 'progress',
    label: 'Progress Update',
    icon: '🎯',
    description: 'System-generated updates from your goal tree',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    fields: [
      { key: 'node_name', label: 'Goal', type: 'text' },
      { key: 'progress_pct', label: 'New Progress %', type: 'number' },
    ],
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name}: ${i.progress_pct}%`).join(', ');
      }
      return `${d.node_name || 'Goal'}: ${d.progress_pct}%`;
    },
  },
  
  // =============================================================================
  // Gaming & Esports Trackers (Level 4: Esteem)
  // =============================================================================
  {
    id: 'gaming',
    label: 'Gaming Session',
    icon: '🎮',
    description: 'Log gaming sessions, playtime, and activities',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    fields: [
      { key: 'game', label: 'Game', type: 'text', placeholder: 'e.g. Elden Ring, Valorant' },
      { key: 'duration', label: 'Duration (min)', type: 'number', placeholder: '60' },
      { key: 'platform', label: 'Platform', type: 'select', options: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'Arcade'], optional: true },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Casual', 'Ranked', 'Competitive', 'Speedrun', 'Completionist', 'Co-op'], optional: true },
      { key: 'notes', label: 'Notes', type: 'text', placeholder: 'Achievements, wins, highlights', optional: true },
    ],
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.name} (${i.duration}min)`).join(', ');
      }
      return `🎮 ${d.game || 'Gaming'} — ${d.duration || '?'}min${d.mode ? ` (${d.mode})` : ''}`;
    },
  },
  {
    id: 'achievements',
    label: 'Achievement Hunter',
    icon: '🏆',
    description: 'Track achievements, trophies, and completions',
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.25)',
    fields: [
      { key: 'game', label: 'Game', type: 'text', placeholder: 'e.g. Dark Souls 3' },
      { key: 'achievement', label: 'Achievement/Trophy', type: 'text', placeholder: 'e.g. Dark Lord' },
      { key: 'rarity', label: 'Rarity', type: 'select', options: ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary'], optional: true },
      { key: 'type', label: 'Type', type: 'select', options: ['Trophy', 'Achievement', 'Steam', 'Xbox', 'PSN', 'Other'], optional: true },
    ],
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.achievement || i.name} in ${i.game}`).join(', ');
      }
      return `🏆 ${d.achievement || 'Achievement'} in ${d.game || '?'}`;
    },
  },
  {
    id: 'rank',
    label: 'Rank Progress',
    icon: '📊',
    description: 'Track competitive rank progression in esports titles',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
    fields: [
      { key: 'game', label: 'Game', type: 'text', placeholder: 'e.g. Valorant, LoL, CS:GO' },
      { key: 'rank', label: 'Current Rank', type: 'text', placeholder: 'e.g. Diamond 2, Global Elite' },
      { key: 'lp_mmr', label: 'LP/MMR (optional)', type: 'text', placeholder: 'e.g. 2500 MMR', optional: true },
      { key: 'peak', label: 'Peak Rank', type: 'text', placeholder: 'e.g. Ascendant 1', optional: true },
    ],
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.rank || i.name} in ${i.game}`).join(', ');
      }
      return `📊 ${d.rank || 'Rank'} in ${d.game || '?'}${d.peak ? ` (Peak: ${d.peak})` : ''}`;
    },
  },
  {
    id: 'streaming',
    label: 'Streaming/Content',
    icon: '📹',
    description: 'Track streaming sessions and content creation',
    color: '#F472B6',
    bg: 'rgba(244,114,182,0.08)',
    border: 'rgba(244,114,182,0.25)',
    fields: [
      { key: 'platform', label: 'Platform', type: 'select', options: ['Twitch', 'YouTube', 'TikTok', 'Kick', 'Other'] },
      { key: 'duration', label: 'Duration (min)', type: 'number', placeholder: '120' },
      { key: 'viewers_avg', label: 'Avg Viewers', type: 'number', placeholder: '25', optional: true },
      { key: 'followers_gained', label: 'Followers Gained', type: 'number', placeholder: '5', optional: true },
      { key: 'content_type', label: 'Content Type', type: 'select', options: ['Live Stream', 'VOD', 'Highlight', 'Tutorial', 'Other'], optional: true },
    ],
    entryLabel: d => {
      if (d.items && Array.isArray(d.items)) {
        return d.items.map(i => `${i.platform || 'Stream'} (${i.duration}min)`).join(', ');
      }
      return `📹 ${d.platform || 'Streaming'} — ${d.duration || '?'}min${d.viewers_avg ? ` (${d.viewers_avg} viewers)` : ''}`;
    },
  },
];

export const TRACKER_MAP: Record<string, TrackerType> = Object.fromEntries(
  TRACKER_TYPES.map(t => [t.id, t])
);

/**
 * Maps each goal domain to the tracker IDs that are automatically
 * activated when a user has goals in that domain.
 * 
 * Updated for Maslow's Hierarchy-based domain system (2026-03-18)
 */
export const DOMAIN_TRACKER_MAP: Record<string, string[]> = {
  // Level 1: Physiological
  'Body & Fitness':                ['lift', 'cardio', 'meal', 'steps'],
  'Rest & Recovery':               ['sleep', 'meditation'],
  'Mental Balance':                ['sleep', 'meditation', 'journal'],

  // Level 2: Safety
  'Environment & Home':            ['project', 'progress'],
  'Health & Longevity':            ['meal', 'steps', 'sleep'],
  'Financial Security':            ['budget', 'expenses', 'investments'],

  // Level 3: Love/Belonging
  'Friendship & Social':           ['hangout', 'adventure'],
  'Romance & Intimacy':            ['hangout', 'adventure', 'journal'],
  'Community & Contribution':      ['hangout', 'project', 'journal'],

  // Level 4: Esteem
  'Career & Craft':                ['study', 'books', 'project', 'job-apps'],
  'Wealth & Assets':               ['investments', 'expenses', 'budget'],
  'Gaming & Esports':              ['gaming', 'achievements', 'rank', 'streaming'],

  // Level 5: Self-Transcendence
  'Impact & Legacy':               ['project', 'journal', 'study'],
  'Spirit & Purpose':              ['journal', 'meditation', 'books'],
};
