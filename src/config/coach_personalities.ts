export type CoachPersonality = 'cheerleader' | 'mentor' | 'drill_sergeant' | 'philosophical' | 'buddy';

export interface CoachPersonalityConfig {
  id: CoachPersonality;
  name: string;
  description: string;
  avatar: string;
  primaryColor: string;
  greetingTemplates: string[];
  motivationTemplates: string[];
  celebrationTemplates: string[];
  challengeTemplates: string[];
  tone: 'encouraging' | 'authoritative' | 'tough' | 'thoughtful' | 'casual';
  emoji: string;
}

export const COACH_PERSONALITIES: Record<CoachPersonality, CoachPersonalityConfig> = {
  cheerleader: {
    id: 'cheerleader',
    name: 'Cheerleader',
    description: 'Enthusiastic and supportive, always ready with encouragement',
    avatar: '🎉',
    primaryColor: '#F59E0B',
    greetingTemplates: [
      'Hey rockstar! Ready to crush some goals today? 🌟',
      'You got this! Let\'s make today amazing! 💪',
      'Welcome back, champion! Ready to level up? 🚀',
    ],
    motivationTemplates: [
      'Every step forward is a victory! Keep going! 🏆',
      'You\'re doing awesome! Don\'t stop now! ✨',
      'I believe in you! You can do this! 🎯',
    ],
    celebrationTemplates: [
      'WOW! You did it! I\'m so proud of you! 🥳',
      'AMAZING! You\'re absolutely crushing it! 🎊',
      'This is incredible! You\'re a goal-getting machine! 🏅',
    ],
    challengeTemplates: [
      'I know you can handle this! You\'re stronger than you think! 💪',
      'Time to level up! This is your moment to shine! 🌟',
    ],
    tone: 'encouraging',
    emoji: '🎉',
  },
  mentor: {
    id: 'mentor',
    name: 'Mentor',
    description: 'Wise and experienced, guides with thoughtful advice',
    avatar: '🧙',
    primaryColor: '#8B5CF6',
    greetingTemplates: [
      'Welcome, traveler. What shall we explore today? 📚',
      'Greetings. The path to progress awaits. Shall we begin? 🌱',
      'Hello again. Ready to continue your journey? 🏔️',
    ],
    motivationTemplates: [
      'Remember: progress is a journey, not a destination. Each effort builds character. 🧠',
      'The wise warrior knows that discipline beats motivation. Stay the course. ⚔️',
      'Consider this: what you do today shapes who you become tomorrow. 📖',
    ],
    celebrationTemplates: [
      'Well earned. The fruits of disciplined effort are the sweetest. 🍎',
      'A milestone achieved. This is what consistent practice yields. 🎓',
      'Excellent work. You\'ve demonstrated the power of commitment. 🏆',
    ],
    challengeTemplates: [
      'The road ahead is demanding, but so are you. Embrace the struggle. ⚡',
      'True growth happens outside comfort. Step forward into the unknown. 🌊',
    ],
    tone: 'thoughtful',
    emoji: '🧙',
  },
  drill_sergeant: {
    id: 'drill_sergeant',
    name: 'Drill Sergeant',
    description: 'Tough and demanding, pushes you to your limits',
    avatar: '👊',
    primaryColor: '#EF4444',
    greetingTemplates: [
      'Atten-tion! Time to get to work! 🫡',
      'Listen up! We\'ve got goals to crush! 💥',
      'Drop and give me twenty! Just kidding... but let\'s GO! 🔥',
    ],
    motivationTemplates: [
      'Excuses don\'t burn calories! Get moving! 🏃',
      'Pain is weakness leaving the body! Push harder! 💪',
      'You\'re tougher than you think! NO QUITTING! 🚀',
    ],
    celebrationTemplates: [
      'THAT\'S WHAT I\'M TALKING ABOUT! Absolutely crushing it! 🔥',
      'Nice work, soldier! But can you do it again?! 🎯',
      'Outstanding! You just proved what I already knew - you\'re a warrior! ⚔️',
    ],
    challengeTemplates: [
      'I don\'t care if you\'re tired. Get back in there! 🫵',
      'This is where champions are made! NO EXCUSES! 💥',
    ],
    tone: 'tough',
    emoji: '👊',
  },
  philosophical: {
    id: 'philosophical',
    name: 'Philosophical',
    description: 'Contemplative and deep, explores the meaning behind goals',
    avatar: '🤔',
    primaryColor: '#06B6D4',
    greetingTemplates: [
      'The unexamined life is not worth living. What shall we examine today? 🌿',
      'Welcome. What is it you truly seek? 💭',
      'Greetings, seeker. The journey of self-improvement begins with a single question: why? 🎯',
    ],
    motivationTemplates: [
      'We suffer more often in imagination than in reality. Are you truly doing your best? 🪞',
      'The obstacle is the way. What seems like a setback may be teaching you something vital. 🌊',
      'Know thyself. Understanding your "why" will unlock your potential. 🔑',
    ],
    celebrationTemplates: [
      'A moment of actualization. You have moved closer to your authentic self. 🌟',
      'Existence precedes essence. Through action, you create yourself. 🎭',
      'You have demonstrated the unity of thought and action. Rare and valuable. ✨',
    ],
    challengeTemplates: [
      'The heavy guard is the soul\'s greatest enemy. Face your resistance. 🛡️',
      'Are you the gardener or the garden? Your habits define your nature. 🌱',
    ],
    tone: 'thoughtful',
    emoji: '🤔',
  },
  buddy: {
    id: 'buddy',
    name: 'Buddy',
    description: 'Casual and friendly, like a supportive mate',
    avatar: '🤝',
    primaryColor: '#22C55E',
    greetingTemplates: [
      'Hey buddy! Good to see you! 👋',
      'What is up! Ready to get stuff done? 😎',
      'Yo! Let us make some progress today! 🚀',
    ],
    motivationTemplates: [
      'We have got this! Just take it one step at a time. No pressure! 👍',
      'It is cool if things get tough, we will figure it out together. That is what friends are for! 🫂',
      'Hey, you are doing great. Even showing up counts for something! 💙',
    ],
    celebrationTemplates: [
      'Dude! You crushed it! So proud of you! 🎉',
      'That is awesome! We should celebrate! High five! ✋',
      'See? I knew you had it in you! Go team! 🏅',
    ],
    challengeTemplates: [
      'I know it is hard, but I also know you can do this. No rush, we have got time. 👍',
      'Do not overthink it - just start. We will adjust along the way! 🎯',
    ],
    tone: 'casual',
    emoji: '🤝',
  },
};

export const getPersonalityById = (id: string): CoachPersonalityConfig | undefined => {
  return COACH_PERSONALITIES[id as CoachPersonality];
};

export const getAllPersonalities = (): CoachPersonalityConfig[] => {
  return Object.values(COACH_PERSONALITIES);
};

export const getRandomGreeting = (personality: CoachPersonality): string => {
  const config = COACH_PERSONALITIES[personality];
  return config.greetingTemplates[Math.floor(Math.random() * config.greetingTemplates.length)];
};

export const getRandomMotivation = (personality: CoachPersonality): string => {
  const config = COACH_PERSONALITIES[personality];
  return config.motivationTemplates[Math.floor(Math.random() * config.motivationTemplates.length)];
};

export const getRandomCelebration = (personality: CoachPersonality): string => {
  const config = COACH_PERSONALITIES[personality];
  return config.celebrationTemplates[Math.floor(Math.random() * config.celebrationTemplates.length)];
};
