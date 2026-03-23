/**
 * Smart Logging Suggestions for Axiom
 * 
 * Provides context-aware prompts that help users log the most useful information
 * for Axiom to track progress on their goals.
 */

import { Domain } from '../types/goal';

export interface LoggingSuggestion {
  id: string;
  text: string;
  category: 'reflection' | 'action' | 'obstacle' | 'milestone' | 'mood' | 'learning';
  priority: number; // Higher = more important
}

/**
 * Goal-specific suggestions organized by domain
 */
export const GOAL_SUGGESTIONS: Record<Domain, LoggingSuggestion[]> = {
  Fitness: [
    { id: 'fitness_1', text: 'What exercise did you complete today? 🏋️', category: 'action', priority: 10 },
    { id: 'fitness_2', text: 'How did your body feel during training? 💪', category: 'reflection', priority: 9 },
    { id: 'fitness_3', text: 'Did you hit your nutrition targets? 🥗', category: 'action', priority: 8 },
    { id: 'fitness_4', text: 'What was your energy level today (1-10)? ⚡', category: 'reflection', priority: 8 },
    { id: 'fitness_5', text: 'Any new personal records or milestones? 🏆', category: 'milestone', priority: 7 },
    { id: 'fitness_6', text: 'What obstacles did you overcome today? 🚧', category: 'obstacle', priority: 6 },
    { id: 'fitness_7', text: 'How consistent were you with your routine? 📊', category: 'reflection', priority: 6 },
  ],
  
  Career: [
    { id: 'career_1', text: 'What meaningful work did you complete today? 💼', category: 'action', priority: 10 },
    { id: 'career_2', text: 'Did you move closer to a career milestone? 🎯', category: 'milestone', priority: 9 },
    { id: 'career_3', text: 'What skills did you practice or learn? 📚', category: 'learning', priority: 8 },
    { id: 'career_4', text: 'Any challenges or blockers at work? 🚧', category: 'obstacle', priority: 7 },
    { id: 'career_5', text: 'How productive were you today (1-10)? ⚡', category: 'reflection', priority: 7 },
    { id: 'career_6', text: 'Did you network or build relationships? 🤝', category: 'action', priority: 6 },
    { id: 'career_7', text: 'What would make tomorrow more productive? 💡', category: 'reflection', priority: 5 },
  ],
  
  Learning: [
    { id: 'learning_1', text: 'What did you study or practice today? 📖', category: 'action', priority: 10 },
    { id: 'learning_2', text: 'What new concept clicked for you? 💡', category: 'learning', priority: 9 },
    { id: 'learning_3', text: 'How long did you focus today (minutes)? ⏱️', category: 'action', priority: 8 },
    { id: 'learning_4', text: 'What was challenging or confusing? 🤔', category: 'obstacle', priority: 7 },
    { id: 'learning_5', text: 'How confident do you feel with the material? 📊', category: 'reflection', priority: 7 },
    { id: 'learning_6', text: 'What will you review or practice next? 🎯', category: 'action', priority: 6 },
    { id: 'learning_7', text: 'Any breakthroughs or "aha" moments? ✨', category: 'milestone', priority: 8 },
  ],
  
  Relationships: [
    { id: 'relationship_1', text: 'Who did you connect with today? 👥', category: 'action', priority: 10 },
    { id: 'relationship_2', text: 'How did you show up for others today? ❤️', category: 'reflection', priority: 9 },
    { id: 'relationship_3', text: 'Any meaningful conversations or moments? 💬', category: 'milestone', priority: 8 },
    { id: 'relationship_4', text: 'Did you resolve any conflicts or tensions? 🕊️', category: 'milestone', priority: 7 },
    { id: 'relationship_5', text: 'How supported do you feel right now? 📊', category: 'reflection', priority: 7 },
    { id: 'relationship_6', text: 'Who needs your attention or care? 🤗', category: 'action', priority: 6 },
    { id: 'relationship_7', text: 'What relationship skill are you working on? 💪', category: 'learning', priority: 5 },
  ],
  
  Finance: [
    { id: 'finance_1', text: 'What financial action did you take today? 💰', category: 'action', priority: 10 },
    { id: 'finance_2', text: 'Did you stay within budget today? 📊', category: 'action', priority: 9 },
    { id: 'finance_3', text: 'Any income earned or savings made? 📈', category: 'milestone', priority: 8 },
    { id: 'finance_4', text: 'What spending triggers did you notice? 🛒', category: 'reflection', priority: 7 },
    { id: 'finance_5', text: 'How confident do you feel about your finances? 📊', category: 'reflection', priority: 7 },
    { id: 'finance_6', text: 'Any financial obstacles or worries? 🚧', category: 'obstacle', priority: 6 },
    { id: 'finance_7', text: 'What financial habit are you building? 🏗️', category: 'learning', priority: 5 },
  ],
  
  Creative: [
    { id: 'creative_1', text: 'What did you create or work on today? 🎨', category: 'action', priority: 10 },
    { id: 'creative_2', text: 'How long did you spend in flow state? ⏱️', category: 'reflection', priority: 8 },
    { id: 'creative_3', text: 'Any new ideas or inspiration today? 💡', category: 'milestone', priority: 9 },
    { id: 'creative_4', text: 'What creative blocks did you face? 🚧', category: 'obstacle', priority: 7 },
    { id: 'creative_5', text: 'How satisfied are you with your progress? 📊', category: 'reflection', priority: 7 },
    { id: 'creative_6', text: 'What will you create tomorrow? 🎯', category: 'action', priority: 6 },
    { id: 'creative_7', text: 'What skill or technique did you practice? 🎯', category: 'learning', priority: 6 },
  ],
  
  Health: [
    { id: 'health_1', text: 'How did you prioritize your health today? 🏥', category: 'action', priority: 10 },
    { id: 'health_2', text: 'What was your stress level (1-10)? 😌', category: 'reflection', priority: 9 },
    { id: 'health_3', text: 'How many hours did you sleep? 😴', category: 'action', priority: 9 },
    { id: 'health_4', text: 'Any symptoms or health wins to note? 📊', category: 'milestone', priority: 8 },
    { id: 'health_5', text: 'Did you take medications/supplements? 💊', category: 'action', priority: 7 },
    { id: 'health_6', text: 'What health habit are you working on? 🏗️', category: 'learning', priority: 6 },
    { id: 'health_7', text: 'How energized do you feel today? ⚡', category: 'reflection', priority: 7 },
  ],
  
  Spiritual: [
    { id: 'spiritual_1', text: 'How did you nurture your spirit today? 🧘', category: 'action', priority: 10 },
    { id: 'spiritual_2', text: 'What are you grateful for today? 🙏', category: 'reflection', priority: 9 },
    { id: 'spiritual_3', text: 'Did you meditate or pray today? 📿', category: 'action', priority: 8 },
    { id: 'spiritual_4', text: 'What insights or revelations came to you? ✨', category: 'milestone', priority: 8 },
    { id: 'spiritual_5', text: 'How connected do you feel to your purpose? 🎯', category: 'reflection', priority: 7 },
    { id: 'spiritual_6', text: 'What doubts or questions arose? 🤔', category: 'obstacle', priority: 6 },
    { id: 'spiritual_7', text: 'How can you deepen your practice? 📈', category: 'learning', priority: 5 },
  ],
  
  Business: [
    { id: 'business_1', text: 'What business milestone did you hit today? 📈', category: 'milestone', priority: 10 },
    { id: 'business_2', text: 'What revenue or growth action did you take? 💰', category: 'action', priority: 9 },
    { id: 'business_3', text: 'Did you talk to customers or users today? 👥', category: 'action', priority: 8 },
    { id: 'business_4', text: 'What metrics improved today? 📊', category: 'milestone', priority: 8 },
    { id: 'business_5', text: 'What business challenges did you face? 🚧', category: 'obstacle', priority: 7 },
    { id: 'business_6', text: 'How confident are you in your business direction? 🎯', category: 'reflection', priority: 7 },
    { id: 'business_7', text: 'What did you learn about your market? 📚', category: 'learning', priority: 6 },
  ],
  
  Personal: [
    { id: 'personal_1', text: 'What made you smile today? 😊', category: 'reflection', priority: 10 },
    { id: 'personal_2', text: 'What important thing did you do today? ✅', category: 'action', priority: 9 },
    { id: 'personal_3', text: 'How are you really feeling right now? 💭', category: 'reflection', priority: 9 },
    { id: 'personal_4', text: 'What are you proud of today? 🏆', category: 'milestone', priority: 8 },
    { id: 'personal_5', text: 'What challenged you today? 🚧', category: 'obstacle', priority: 7 },
    { id: 'personal_6', text: 'What did you learn about yourself? 🪞', category: 'learning', priority: 8 },
    { id: 'personal_7', text: 'What's one thing you want to improve tomorrow? 📈', category: 'reflection', priority: 6 },
  ],
};

/**
 * General mood/wellbeing suggestions for free-form logging
 */
export const GENERAL_SUGGESTIONS: LoggingSuggestion[] = [
  { id: 'general_1', text: 'What was the highlight of your day? ⭐', category: 'reflection', priority: 10 },
  { id: 'general_2', text: 'How are you feeling right now, really? 💭', category: 'mood', priority: 10 },
  { id: 'general_3', text: 'What's one thing you accomplished today? ✅', category: 'milestone', priority: 9 },
  { id: 'general_4', text: 'What's on your mind that needs attention? 🤔', category: 'obstacle', priority: 8 },
  { id: 'general_5', text: 'What are you grateful for today? 🙏', category: 'reflection', priority: 8 },
  { id: 'general_6', text: 'What drained your energy today? 🔋', category: 'obstacle', priority: 7 },
  { id: 'general_7', text: 'What gave you energy today? ⚡', category: 'reflection', priority: 7 },
  { id: 'general_8', text: 'What's worrying you right now? 😟', category: 'obstacle', priority: 7 },
  { id: 'general_9', text: 'What made you laugh today? 😂', category: 'reflection', priority: 6 },
  { id: 'general_10', text: 'What's one lesson from today? 📚', category: 'learning', priority: 6 },
  { id: 'general_11', text: 'How did you show up for yourself today? 💪', category: 'reflection', priority: 8 },
  { id: 'general_12', text: 'What do you need right now? 🤗', category: 'reflection', priority: 7 },
];

/**
 * Get suggestions for a specific goal domain
 * Returns top 5 suggestions sorted by priority
 */
export function getSuggestionsForDomain(domain: Domain | string): LoggingSuggestion[] {
  const domainSuggestions = GOAL_SUGGESTIONS[domain as Domain] || GENERAL_SUGGESTIONS;
  return domainSuggestions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

/**
 * Get general suggestions for free-form logging
 * Returns top 6 suggestions sorted by priority
 */
export function getGeneralSuggestions(): LoggingSuggestion[] {
  return GENERAL_SUGGESTIONS
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}

/**
 * Get suggestions by category
 */
export function getSuggestionsByCategory(
  domain: Domain | string,
  category: LoggingSuggestion['category']
): LoggingSuggestion[] {
  const domainSuggestions = GOAL_SUGGESTIONS[domain as Domain] || GENERAL_SUGGESTIONS;
  return domainSuggestions
    .filter(s => s.category === category)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}

/**
 * Get a rotating "suggestion of the day" based on date
 */
export function getSuggestionOfTheDay(domain?: Domain | string): LoggingSuggestion {
  const today = new Date().toDateString();
  const hash = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const suggestions = domain 
    ? getSuggestionsForDomain(domain)
    : getGeneralSuggestions();
  
  const index = hash % suggestions.length;
  return suggestions[index];
}
