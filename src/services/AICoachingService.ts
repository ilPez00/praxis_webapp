import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger';

export interface GoalContext {
  name: string;
  domain: string;
  progress: number; // 0-100
  description?: string;
  completionMetric?: string;
  targetDate?: string;
}

export interface NetworkContact {
  name: string;
  domains: string[];
}

export interface BoardContext {
  name: string;
  domain?: string;
  description?: string;
}

export interface CoachingContext {
  userName: string;
  bio?: string;
  streak: number;
  praxisPoints: number;
  goals: GoalContext[];
  recentFeedback: Array<{ grade: string; comment?: string; giverName: string; goalName: string }>;
  achievements: Array<{ goalName: string; date: string }>;
  network: NetworkContact[];
  boards: BoardContext[];
}

/** Structured coaching report returned from generateFullReport */
export interface CoachingReport {
  motivation: string;
  strategy: Array<{
    goal: string;
    domain: string;
    progress: number;
    insight: string;
    steps: string[];
  }>;
  network: string;
}

export class AICoachingService {
  private genAI: GoogleGenerativeAI;
  private readonly MODEL = 'gemini-flash-lite-latest';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment variables.');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generates a full structured coaching report (motivation + per-goal strategy + network leverage).
   * Returns a parsed CoachingReport object.
   */
  public async generateFullReport(context: CoachingContext): Promise<CoachingReport> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.MODEL,
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = this.buildReportPrompt(context);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const parsed = JSON.parse(text) as CoachingReport;
      return parsed;
    } catch (error) {
      logger.error('Error generating coaching report:', error);
      throw new Error('Failed to generate coaching report.');
    }
  }

  /**
   * Generates a conversational follow-up response to a user's question.
   * Returns plain text.
   */
  public async generateCoachingResponse(userPrompt: string, context: CoachingContext): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.MODEL });
      const prompt = this.buildFollowUpPrompt(userPrompt, context);
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      logger.error('Error generating coaching response:', error);
      throw new Error('Failed to generate coaching response.');
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt builders
  // ---------------------------------------------------------------------------

  private buildReportPrompt(ctx: CoachingContext): string {
    const goalsText = ctx.goals.length === 0
      ? 'No goals set yet.'
      : ctx.goals.map(g => {
          let line = `- "${g.name}" (${g.domain}, ${g.progress}% complete)`;
          if (g.description) line += `. Description: ${g.description}`;
          if (g.completionMetric) line += `. Success metric: ${g.completionMetric}`;
          if (g.targetDate) line += `. Target date: ${g.targetDate}`;
          return line;
        }).join('\n');

    const feedbackText = ctx.recentFeedback.length === 0
      ? 'No recent feedback.'
      : ctx.recentFeedback.map(f =>
          `- On "${f.goalName}": grade="${f.grade}" from ${f.giverName}${f.comment ? ` — "${f.comment}"` : ''}`
        ).join('\n');

    const achievementsText = ctx.achievements.length === 0
      ? 'No completed achievements yet.'
      : ctx.achievements.map(a => `- Completed "${a.goalName}" on ${a.date}`).join('\n');

    const networkText = ctx.network.length === 0
      ? 'No network connections yet.'
      : ctx.network.map(n => `- ${n.name} (domains: ${n.domains.join(', ') || 'unknown'})`).join('\n');

    const boardsText = ctx.boards.length === 0
      ? 'Not a member of any community boards yet.'
      : ctx.boards.map(b => `- "${b.name}"${b.domain ? ` [${b.domain}]` : ''}${b.description ? `: ${b.description}` : ''}`).join('\n');

    return `You are Praxis AI, an elite performance coach. You deeply understand human psychology, goal achievement, and social accountability. Analyse all data about this user and generate a comprehensive coaching report in the exact JSON schema below.

## User Profile
Name: ${ctx.userName}
${ctx.bio ? `Bio: ${ctx.bio}` : ''}
Current streak: ${ctx.streak} days
Praxis Points: ${ctx.praxisPoints}

## Goals
${goalsText}

## Recent Peer Feedback
${feedbackText}

## Achievements
${achievementsText}

## Network Connections (users they have collaborated with)
${networkText}

## Community Boards (boards they have joined)
${boardsText}

## Instructions
Return ONLY valid JSON matching this schema (no markdown, no extra text):
{
  "motivation": "<2-3 sentences of personalised, specific, and energising motivational message referencing their actual goals, streak, and achievements>",
  "strategy": [
    {
      "goal": "<exact goal name>",
      "domain": "<domain>",
      "progress": <number 0-100>,
      "insight": "<1 sentence specific insight about their current progress on this goal>",
      "steps": ["<concrete action step 1>", "<concrete action step 2>", "<concrete action step 3>"]
    }
  ],
  "network": "<2-3 sentences on how ${ctx.userName} should specifically leverage their network connections and community boards to accelerate progress — be specific about which connections or boards are most relevant and what actions to take>"
}

Generate the strategy array with one entry per goal. Make every piece of advice concrete, actionable, and personalised to this specific user's data.`;
  }

  private buildFollowUpPrompt(userPrompt: string, ctx: CoachingContext): string {
    const goalsSummary = ctx.goals
      .map(g => `${g.name} (${g.domain}, ${g.progress}% done)`)
      .join('; ') || 'none';

    const networkSummary = ctx.network.map(n => n.name).join(', ') || 'none';
    const boardsSummary = ctx.boards.map(b => b.name).join(', ') || 'none';

    return `You are Praxis AI, an elite performance coach. The user is ${ctx.userName} (${ctx.streak}-day streak, ${ctx.praxisPoints} Praxis Points).

Their goals: ${goalsSummary}
Their network: ${networkSummary}
Their boards: ${boardsSummary}

The user asks: "${userPrompt}"

Respond concisely (2-4 sentences) with specific, actionable coaching advice personalised to their situation. Reference their actual goals or connections where relevant.`;
  }
}
