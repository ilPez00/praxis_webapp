import { COACH_PERSONALITIES, CoachPersonality, getRandomGreeting, getRandomMotivation, getRandomCelebration } from '../config/coach_personalities';

export interface CoachMessageRequest {
  userMessage: string;
  userGoals: any[];
  userStreak: number;
  recentProgress: string;
  personality: CoachPersonality;
}

export interface CoachMessageResponse {
  message: string;
  personality: CoachPersonality;
  suggestions?: string[];
  action?: 'encourage' | 'challenge' | 'celebrate' | 'advice';
}

export class CoachPersonalityService {
  generateGreeting(personality: CoachPersonality): string {
    return getRandomGreeting(personality);
  }

  generateMotivation(personality: CoachPersonality, context?: string): string {
    let msg = getRandomMotivation(personality);
    if (context) {
      const config = COACH_PERSONALITIES[personality];
      msg = `${context} ${msg}`;
    }
    return msg;
  }

  generateCelebration(personality: CoachPersonality, achievement: string): string {
    let msg = getRandomCelebration(personality);
    return `${achievement} ${msg}`;
  }

  processUserMessage(request: CoachMessageRequest): CoachMessageResponse {
    const { userMessage, userGoals, userStreak, recentProgress, personality } = request;
    const config = COACH_PERSONALITIES[personality];
    
    const lowerMessage = userMessage.toLowerCase();
    let message = '';
    let action: CoachMessageResponse['action'] = 'advice';

    if (lowerMessage.includes('struggling') || lowerMessage.includes('hard') || lowerMessage.includes('difficult')) {
      message = this.generateStrugglingResponse(personality, userGoals);
      action = 'encourage';
    } else if (lowerMessage.includes('give up') || lowerMessage.includes('quit') || lowerMessage.includes('can\'t')) {
      message = this.generateEncouragementResponse(personality);
      action = 'encourage';
    } else if (lowerMessage.includes('done') || lowerMessage.includes('completed') || lowerMessage.includes('finished')) {
      message = this.generateCelebrationResponse(personality, recentProgress);
      action = 'celebrate';
    } else if (lowerMessage.includes('tired') || lowerMessage.includes('exhausted') || lowerMessage.includes('burnout')) {
      message = this.generateTiredResponse(personality);
      action = 'advice';
    } else if (lowerMessage.includes('challenge') || lowerMessage.includes('push') || lowerMessage.includes('harder')) {
      message = this.generateChallengeResponse(personality);
      action = 'challenge';
    } else if (userStreak > 7) {
      message = this.generateStreakMotivation(personality, userStreak);
      action = 'celebrate';
    } else {
      message = this.generateDefaultResponse(personality, userGoals);
      action = 'advice';
    }

    const suggestions = this.getSuggestionsForAction(action, personality);

    return {
      message,
      personality,
      suggestions,
      action,
    };
  }

  private generateStrugglingResponse(personality: CoachPersonality, userGoals: any[]): string {
    const config = COACH_PERSONALITIES[personality];
    const responses = [
      'I understand it feels tough right now. Remember why you started. Your goals are waiting for you!',
      'Struggle is where growth happens. You\'re stronger than this moment.',
      'Every expert was once a beginner. Keep going, one step at a time.',
      'The fact that you\'re still trying? That\'s what matters. Don\'t give up now.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateEncouragementResponse(personality: CoachPersonality): string {
    const config = COACH_PERSONALITIES[personality];
    const responses = [
      'Don\'t even think about quitting! You\'ve come too far to give up now.',
      'I believe in you. Even when you don\'t, I do.',
      'This is just a rough patch. You have what it takes to push through.',
      'Quitting is easy. Staying is what builds character. Choose to stay.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateCelebrationResponse(personality: CoachPersonality, achievement: string): string {
    return getRandomCelebration(personality);
  }

  private generateTiredResponse(personality: CoachPersonality): string {
    const config = COACH_PERSONALITIES[personality];
    if (personality === 'drill_sergeant') {
      return 'Rest is for the weak! Just kidding - take a short break, then get back to it.';
    }
    if (personality === 'mentor' || personality === 'philosophical') {
      return 'Even the longest journey begins with a single step. Rest when needed, but never stop entirely.';
    }
    if (personality === 'buddy') {
      return 'Hey, it\'s okay to take a break! Pacing yourself is smart. We\'ll be here when you\'re ready.';
    }
    return 'Take care of yourself! A short rest will help you come back stronger.';
  }

  private generateChallengeResponse(personality: CoachPersonality): string {
    const config = COACH_PERSONALITIES[personality];
    const responses = [
      'Time to level up! I knew you had it in you.',
      'Challenge accepted? Let\'s show the universe what you\'re made of.',
      'This is your moment. Rise to the occasion!',
      'Great athletes push harder when it gets tough. Be great.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateStreakMotivation(personality: CoachPersonality, streak: number): string {
    if (personality === 'cheerleader') {
      return `${streak} days! YOU\'RE UNSTOPPABLE! 🔥 Keep this momentum going!`;
    }
    if (personality === 'drill_sergeant') {
      return `${streak} days in a row! That\'s discipline! Now let\'s see if you can make it ${streak + 1}!`;
    }
    if (personality === 'mentor') {
      return `${streak} days of consistent effort. This is what builds真正的 character. Well done.`;
    }
    return `Incredible ${streak} day streak! Your dedication is inspiring.`;
  }

  private generateDefaultResponse(personality: CoachPersonality, userGoals: any[]): string {
    const config = COACH_PERSONALITIES[personality];
    if (userGoals && userGoals.length > 0) {
      const goalNames = userGoals.slice(0, 3).map((g: any) => g.name).join(', ');
      return `Let\'s focus on making progress on ${goalNames}. What\'s the next step?`;
    }
    return getRandomMotivation(personality);
  }

  private getSuggestionsForAction(action: string, personality: CoachPersonality): string[] {
    const suggestions: Record<string, string[]> = {
      encourage: [
        'Take a 5-minute break',
        'Break your goal into smaller steps',
        'Share your progress with a friend',
        'Remind yourself why you started',
      ],
      challenge: [
        'Double your effort today',
        'Complete one task right now',
        'Push beyond your comfort zone',
        'Set a new personal record',
      ],
      celebrate: [
        'Share your win with the community',
        'Reward yourself with something nice',
        'Reflect on how far you\'ve come',
        'Set your next goal',
      ],
      advice: [
        'What\'s holding you back?',
        'Let\'s break this down together',
        'What would you tell a friend in this situation?',
        'Consider asking for help',
      ],
    };
    return suggestions[action] || suggestions.advice;
  }
}

export const coachPersonalityService = new CoachPersonalityService();
