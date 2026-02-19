import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger'; // Import the logger

/**
 * @class AICoachingService
 * @description Encapsulates interactions with the Google Gemini API for AI coaching functionalities.
 * This service is responsible for generating personalized insights and guidance based on user data.
 */
export class AICoachingService {
  private genAI: GoogleGenerativeAI;
  private readonly GEMINI_MODEL: string = 'gemini-pro'; // Or 'gemini-1.5-flash' depending on needs

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * @description Generates a coaching response based on a user's prompt and provided context.
   * @param userPrompt - The specific question or request from the user.
   * @param context - Additional data about the user's goals, progress, feedback, etc., to inform the AI.
   * @returns A promise that resolves to the AI's coaching response (text).
   */
  public async generateCoachingResponse(userPrompt: string, context: any): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.GEMINI_MODEL });

      // Construct a comprehensive prompt for the Gemini model.
      // This prompt engineering is crucial for getting relevant and helpful responses.
      const fullPrompt = this.constructCoachingPrompt(userPrompt, context);

      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();
      return text;
    } catch (error) {
      logger.error('Error generating AI coaching response:', error);
      throw new Error('Failed to generate AI coaching response.');
    }
  }

  /**
   * @description Constructs the prompt for the Gemini API, combining user input with structured context.
   * This is a critical method for guiding the AI's response.
   * @param userPrompt - The direct question or request from the user.
   * @param context - An object containing relevant user data (goals, progress, feedback).
   * @returns A string representing the full prompt for the Gemini model.
   */
  private constructCoachingPrompt(userPrompt: string, context: any): string {
    let prompt = `You are an AI life and career coach named Praxis AI. Your goal is to provide insightful, supportive, and actionable guidance to users based on their personal development goals. Always maintain a positive, encouraging, and constructive tone. When providing advice, suggest concrete actions or perspectives.`;

    if (context.userName) {
      prompt += `

User's Name: ${context.userName}.`;
    }

    if (context.goals && context.goals.length > 0) {
      prompt += `

User's Goals Overview:`;
      context.goals.forEach((goal: any) => {
        prompt += `
- Goal: "${goal.name}" (Domain: ${goal.domain}, Progress: ${Math.round(goal.progress * 100)}%, Weight: ${goal.weight.toFixed(1)}). Details: ${goal.customDetails || 'No specific details.'}`;
        if (goal.prerequisiteGoalNames && goal.prerequisiteGoalNames.length > 0) {
            prompt += ` Prerequisites: ${goal.prerequisiteGoalNames.join(', ')}.`;
        }
      });
    }

    if (context.recentFeedback && context.recentFeedback.length > 0) {
      prompt += `

Recent Feedback Received:`;
      context.recentFeedback.forEach((feedback: any) => {
        prompt += `
- On goal "${feedback.goalName}", received "${feedback.grade}" from ${feedback.giverName}. Comment: "${feedback.comment || 'N/A'}".`;
      });
    }

    if (context.achievements && context.achievements.length > 0) {
        prompt += `

User's Achievements:`;
        context.achievements.forEach((achievement: any) => {
            prompt += `
- Completed "${achievement.goalName}" on ${new Date(achievement.createdAt).toLocaleDateString()}.`;
        });
    }

    prompt += `

User's Request: ${userPrompt}`;
    prompt += `

Based on this information, please provide a personalized coaching response. Focus on actionable advice, encouragement, and insights related to their goals and progress.`;

    return prompt;
  }
}
