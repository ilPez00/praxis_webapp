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

// Axiom's identity — injected into every prompt
const AXIOM_IDENTITY = `You are Axiom — a wise, warm, and practical life coach who has spent decades helping people achieve their most important goals. You are deeply experienced in strategy, habit formation, nutrition, training, productivity, and performance — and you bring genuine enthusiasm for each person's specific situation. Your tone is friendly and direct, like a trusted mentor who happens to know a lot. You speak simply, without jargon or academic citations. You ask good questions when you need more context. You give practical, concrete guidance: weekly plans, daily routines, meal ideas, accountability systems, and next actions. When asked to analyze someone's posts, goals, groups, or services, you give honest, useful feedback. You celebrate wins without hollow cheerleading, and you name obstacles clearly without judgment. You never cite books by name or author. You just give people what they need to move forward.`;

export class AICoachingService {
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  
  // Most stable base model names
  private readonly FALLBACK_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-2.0-flash',
  ];

  constructor() {
    const keyString = process.env.GEMINI_API_KEY || '';
    this.apiKeys = keyString
      .split(',')
      .map(k => k.replace(/['"]+/g, '').trim())
      .filter(Boolean);

    if (this.apiKeys.length === 0) {
      logger.warn('[AICoachingService] No GEMINI_API_KEY set.');
    } else {
      logger.info(`[AICoachingService] Active with ${this.apiKeys.length} keys.`);
    }
  }

  get isConfigured(): boolean {
    return this.apiKeys.length > 0;
  }

  private getGenAI(): GoogleGenerativeAI {
    const key = this.apiKeys[this.currentKeyIndex];
    return new GoogleGenerativeAI(key);
  }

  private rotateKey() {
    if (this.apiKeys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      logger.info(`[AI Coach] Rotated to Key index ${this.currentKeyIndex}`);
    }
  }

  /**
   * Helper to attempt a generation with model fallbacks.
   */
  private async runWithFallback(
    prompt: string,
    isJson: boolean = false
  ): Promise<string> {
    if (this.apiKeys.length === 0) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const preferredModel = process.env.GEMINI_MODEL;
    const modelsToTry = preferredModel 
      ? [preferredModel, ...this.FALLBACK_MODELS]
      : this.FALLBACK_MODELS;

    const errors: string[] = [];

    for (const modelName of modelsToTry) {
      // Try both v1 and v1beta for every model
      for (const apiVersion of ['v1', 'v1beta'] as const) {
        // Try each API Key we have
        for (let keyAttempt = 0; keyAttempt < Math.min(this.apiKeys.length, 3); keyAttempt++) {
          const genAI = this.getGenAI();

          // Try with and without JSON mode if requested
          const modes = isJson ? ['json', 'text'] : ['text'];

          for (const mode of modes) {
            for (let attempt = 1; attempt <= 1; attempt++) { // Reduced inner attempts to speed up chain
              try {
                const generationConfig: any = {};
                if (mode === 'json') {
                  generationConfig.responseMimeType = 'application/json';
                }

                const model = genAI.getGenerativeModel({
                  model: modelName,
                  generationConfig,
                }, { apiVersion });

                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();
                if (text) return text;
              } catch (error: any) {
                const message = error.message || String(error);
                const status = error.status || error.statusCode || 0;
                
                // Track full errors to show in debug box (no more splitting)
                errors.push(`[${modelName}|${apiVersion}|K${this.currentKeyIndex}] ${message}`);

                // If key is bad, rotate
                if (status === 429 || status === 400 || message.includes('API key') || message.includes('quota')) {
                  this.rotateKey();
                  break; 
                }
                
                if (status === 404 || message.includes('not found') || message.includes('not supported')) {
                  break; 
                }
              }
            }
          }
        }
      }
    }

    const uniqueErrors = Array.from(new Set(errors)).slice(0, 10).join(' | ');
    throw new Error(`Axiom remains offline. Tried multiple keys/versions. Errors: ${uniqueErrors}`);
  }

  /**
   * Generates a full structured coaching report (motivation + per-goal strategy + network leverage).
   * Returns a parsed CoachingReport object.
   */
  public async generateFullReport(context: CoachingContext): Promise<CoachingReport> {
    const prompt = this.buildReportPrompt(context);
    try {
      const text = await this.runWithFallback(prompt, true);
      
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      let parsed: CoachingReport;
      try {
        parsed = JSON.parse(cleaned) as CoachingReport;
      } catch {
        logger.error('[AI Coach] JSON parse failed. Raw response:', text.slice(0, 500));
        throw new Error('Axiom returned an unexpected response format. Please try again.');
      }
      return parsed;
    } catch (error: any) {
      logger.error('Error generating coaching report:', error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Generates a short weekly narrative (2-3 sentences) in Axiom's voice.
   * Used for the Dashboard "This week" card.
   */
  public async generateWeeklyNarrative(stats: {
    userName: string;
    streak: number;
    checkinsThisWeek: number;
    topGoal?: string;
    topDomain?: string;
    overallProgress?: number; // avg 0-100
  }): Promise<string> {
    const { userName, streak, checkinsThisWeek, topGoal, topDomain, overallProgress } = stats;
    const prompt = `${AXIOM_IDENTITY}

You are writing a weekly progress narrative for ${userName}.

Stats this week:
- Check-ins: ${checkinsThisWeek}/7 days
- Current streak: ${streak} days
${topGoal ? `- Main focus: "${topGoal}"${topDomain ? ` (${topDomain})` : ''}` : '- No active goals set yet'}
${overallProgress !== undefined ? `- Average goal progress: ${overallProgress}%` : ''}

Write 2-3 short sentences in Axiom's voice that:
1. Acknowledge what they showed this week (specific, not generic)
2. Name the most important thing to focus on next
3. End with something that creates a tiny bit of urgency or excitement

Tone: warm, direct, no fluff. No greeting, no sign-off. Just the narrative.`;

    try {
      return await this.runWithFallback(prompt);
    } catch (error: any) {
      logger.error('Error generating weekly narrative:', error.message);
      throw new Error(error.message);
    }
  }

  /**
   * Generates a conversational follow-up response to a user's question.
   * Returns plain text.
   */
  public async generateCoachingResponse(userPrompt: string, context: CoachingContext): Promise<string> {
    try {
      const prompt = this.buildFollowUpPrompt(userPrompt, context);
      return await this.runWithFallback(prompt);
    } catch (error: any) {
      logger.error('Error generating coaching response:', error.message);
      throw new Error(error.message);
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

    return `${AXIOM_IDENTITY}

---

## Student Profile
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

## Network Connections
${networkText}

## Community Boards
${boardsText}

---

## Instructions
You are Axiom delivering a coaching report. Keep advice concrete, practical, and personal. Reference what you know about performance, habits, nutrition, and execution when relevant.

Return ONLY valid JSON matching this schema (no markdown, no extra text):
{
  "motivation": "<2-3 sentences from Axiom — warm, personal, grounded in their actual situation (goals, streak, recent activity). Acknowledge where they are honestly. If things are going well, say so. If there's room to grow, say that too — but with care, not pressure.>",
  "strategy": [
    {
      "goal": "<exact goal name>",
      "domain": "<domain>",
      "progress": <number 0-100>,
      "insight": "<1 sentence specific insight about their current progress>",
      "steps": ["<concrete action step 1>", "<concrete action step 2>", "<concrete action step 3>"]
    }
  ],
  "network": "<2-3 sentences on how ${ctx.userName} should leverage their network and community boards — be specific about which connections or boards are most relevant and what actions to take>"
}

Generate one strategy entry per goal. Every insight and step must be concrete, actionable, and drawn from this student's actual data.`;
  }

  private buildFollowUpPrompt(userPrompt: string, ctx: CoachingContext): string {
    const goalsSummary = ctx.goals
      .map(g => `${g.name} (${g.domain}, ${g.progress}% done)`)
      .join('; ') || 'none';

    const networkSummary = ctx.network.map(n => n.name).join(', ') || 'none';
    const boardsSummary = ctx.boards.map(b => b.name).join(', ') || 'none';

    return `${AXIOM_IDENTITY}

---

## About ${ctx.userName}
Streak: ${ctx.streak} days | Praxis Points: ${ctx.praxisPoints}
Goals: ${goalsSummary}
Network: ${networkSummary}
Boards: ${boardsSummary}

---

${ctx.userName} asks: "${userPrompt}"

Respond as Axiom. Match your response to what they actually need:
- If they're asking for a plan, schedule, or step-by-step breakdown — give them one, with concrete specifics.
- If they're asking for advice or a perspective — be direct and grounded.
- If they want encouragement — give it genuinely, not generically. Reference something real about their situation.
- Keep it conversational. Don't pad, don't lecture. Longer is fine if the question warrants it.`;
  }
}
