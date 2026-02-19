/**
 * Mock match profiles for demo/empty-state display.
 *
 * Shown when the backend returns 0 real matches (e.g. new user with no goal tree yet,
 * or backend is unreachable). Gives new users the "wow" moment of seeing what
 * aligned matches look like before the real matching engine kicks in.
 *
 * Replace or remove after beta once organic matches accumulate.
 */

export type ProgressPace = 'Consistent' | 'Rapid' | 'Learning' | 'Adapting';

export interface MockMatch {
  id: string;
  name: string;
  avatarUrl: string;
  compatibility: number; // 0–100
  sharedDomains: string[];
  sharedGoals: string[];
  progressPace: ProgressPace;
  bio: string;
  overallProgress: number; // 0–100, weighted average across their goals
}

export const mockMatches: MockMatch[] = [
  {
    id: 'demo-1',
    name: 'Sara Milano',
    avatarUrl: 'https://i.pravatar.cc/150?img=68',
    compatibility: 87,
    sharedDomains: ['Career', 'Investing', 'Fitness'],
    sharedGoals: [
      'Ship a SaaS project to meaningful revenue',
      'Reach €100k investment portfolio via index funds',
      'Run 10k under 50 minutes',
    ],
    progressPace: 'Consistent',
    bio: 'Software engineer building in public. Running my first marathon while investing in index funds. Open to serious accountability partners.',
    overallProgress: 51,
  },
  {
    id: 'demo-2',
    name: 'Yuki Tanaka',
    avatarUrl: 'https://i.pravatar.cc/150?img=28',
    compatibility: 91,
    sharedDomains: ['Career', 'Philosophical Development', 'Academics'],
    sharedGoals: [
      'Write and publish a technical book',
      'Apply Stoic daily practices for a full year',
      'Complete a rigorous self-directed learning curriculum',
    ],
    progressPace: 'Consistent',
    bio: 'Principal engineer at fintech scale-up. Deep into distributed systems and Stoic philosophy. Serious about long-term compounding in all areas of life.',
    overallProgress: 55,
  },
  {
    id: 'demo-3',
    name: 'Priya Sharma',
    avatarUrl: 'https://i.pravatar.cc/150?img=54',
    compatibility: 82,
    sharedDomains: ['Academics', 'Career', 'Mental Health'],
    sharedGoals: [
      'Publish research in a top-tier journal',
      'Build a sustainable work-life balance without guilt',
      'Secure a career-defining opportunity by end of year',
    ],
    progressPace: 'Rapid',
    bio: 'Neuroscience postdoc optimizing for career excellence and inner peace simultaneously. Looking for science-minded people who also care about well-being.',
    overallProgress: 36,
  },
  {
    id: 'demo-4',
    name: 'Marco Chen',
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
    compatibility: 76,
    sharedDomains: ['Career', 'Academics', 'Philosophical Development'],
    sharedGoals: [
      'Land a senior role at a top AI company',
      'Publish research on emerging AI topics',
    ],
    progressPace: 'Rapid',
    bio: 'PhD dropout turned ML engineer. Reading philosophy at night, building LLM tooling by day. Looking for people who think long-term about technology.',
    overallProgress: 44,
  },
  {
    id: 'demo-5',
    name: 'Lena Müller',
    avatarUrl: 'https://i.pravatar.cc/150?img=47',
    compatibility: 74,
    sharedDomains: ['Fitness', 'Mental Health'],
    sharedGoals: [
      'Complete a triathlon (Olympic distance)',
      'Build consistent mindfulness practice',
    ],
    progressPace: 'Consistent',
    bio: 'Therapist-in-training and amateur triathlete. Passionate about the intersection of physical performance and mental resilience.',
    overallProgress: 65,
  },
  {
    id: 'demo-6',
    name: 'Carlos Reyes',
    avatarUrl: 'https://i.pravatar.cc/150?img=33',
    compatibility: 68,
    sharedDomains: ['Investing', 'Career'],
    sharedGoals: [
      'Build a startup to €1M ARR',
      'Deploy capital strategically into early-stage companies',
    ],
    progressPace: 'Adapting',
    bio: 'Bootstrapped two companies, sold one. Now angel investing while building again. Interested in founders who think differently.',
    overallProgress: 28,
  },
  {
    id: 'demo-7',
    name: 'Tom Hansen',
    avatarUrl: 'https://i.pravatar.cc/150?img=7',
    compatibility: 58,
    sharedDomains: ['Fitness', 'Culture / Hobbies / Creative Pursuits'],
    sharedGoals: [
      'Achieve a major endurance athletic milestone',
      'Learn a creative skill to an intermediate level',
    ],
    progressPace: 'Learning',
    bio: 'Former pro cyclist now coaching. Exploring what it means to compete when the prize is personal growth. Into stoicism, jazz, and cold water swimming.',
    overallProgress: 39,
  },
];
