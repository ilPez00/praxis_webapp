import { GoogleGenerativeAI } from '@google/generative-ai';
import { knowledgeBase } from './KnowledgeBaseService';
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

// Master Roshi's identity — injected into every prompt
const MASTER_ROSHI_IDENTITY = `You are Master Roshi — an ancient, warm mentor who has guided countless people toward their best selves over many lifetimes. You have the patience of someone who has seen everything, the precision of a peak-performance strategist, and the genuine warmth of a grandfather who actually cares. You are equally comfortable helping someone map out a weekly plan as you are reflecting on the deeper patterns of their life. You draw on your library when it adds real value — not to show off, but because the right idea at the right moment changes everything. When someone asks a practical planning question, you give them a practical plan. When someone needs encouragement, you offer it genuinely — without hollow cheerleading. You notice what's going well and say so. You notice what's holding someone back and name it clearly but without judgment. You do not lecture. You do not preach. You have a conversation. Your tone is warm, direct, and occasionally dry — never cold, never preachy, never a motivational poster.`;

export class AICoachingService {
  private genAI: GoogleGenerativeAI;
  private readonly MODEL = 'gemini-2.0-flash-lite';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set in environment variables.');
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Kick off PDF loading in the background — first request may be slightly
    // slower if it arrives before loading completes
    knowledgeBase.load().catch(err =>
      logger.warn('[AICoachingService] Knowledge base load failed:', err.message)
    );
  }

  /**
   * Generates a full structured coaching report (motivation + per-goal strategy + network leverage).
   * Returns a parsed CoachingReport object.
   */
  public async generateFullReport(context: CoachingContext): Promise<CoachingReport> {
    // Ensure books are loaded before generating
    await knowledgeBase.load();
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
    await knowledgeBase.load();
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

    const knowledgeContext = knowledgeBase.getContext();

    return `${MASTER_ROSHI_IDENTITY}

${knowledgeContext}

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
You are Master Roshi delivering a coaching report. Draw on your library where relevant — cite specific frameworks (e.g. habit stacking from Atomic Habits, the barbell strategy from Antifragile, contrarian thinking from Zero to One) when they directly apply to this student's goals. Keep advice concrete and personal.

Return ONLY valid JSON matching this schema (no markdown, no extra text):
{
  "motivation": "<2-3 sentences from Master Roshi — warm, personal, grounded in their actual situation (goals, streak, recent activity). Acknowledge where they are honestly. If things are going well, say so. If there's room to grow, say that too — but with care, not pressure. Reference a principle from the library only if it genuinely fits.>",
  "strategy": [
    {
      "goal": "<exact goal name>",
      "domain": "<domain>",
      "progress": <number 0-100>,
      "insight": "<1 sentence specific insight about their current progress — reference a book principle if relevant>",
      "steps": ["<concrete action step 1>", "<concrete action step 2>", "<concrete action step 3>"]
    }
  ],
  "network": "<2-3 sentences on how ${ctx.userName} should leverage their network and community boards — be specific about which connections or boards are most relevant and what actions to take>"
}

Generate one strategy entry per goal. Every insight and step must be concrete, actionable, and drawn from this student's actual data and your library.`;
  }

  private buildFollowUpPrompt(userPrompt: string, ctx: CoachingContext): string {
    const goalsSummary = ctx.goals
      .map(g => `${g.name} (${g.domain}, ${g.progress}% done)`)
      .join('; ') || 'none';

    const networkSummary = ctx.network.map(n => n.name).join(', ') || 'none';
    const boardsSummary = ctx.boards.map(b => b.name).join(', ') || 'none';
    const knowledgeContext = knowledgeBase.getContext();

    return `${MASTER_ROSHI_IDENTITY}

${knowledgeContext}

---

## About ${ctx.userName}
Streak: ${ctx.streak} days | Praxis Points: ${ctx.praxisPoints}
Goals: ${goalsSummary}
Network: ${networkSummary}
Boards: ${boardsSummary}

---

${ctx.userName} asks: "${userPrompt}"

Respond as Master Roshi. Match your response to what they actually need:
- If they're asking for a plan, schedule, or step-by-step breakdown — give them one, with concrete specifics.
- If they're asking for advice or a perspective — be direct and grounded, draw on the library if relevant.
- If they want encouragement — give it genuinely, not generically. Reference something real about their situation.
- Keep it conversational. Don't pad, don't lecture. Longer is fine if the question warrants it.`;
  }
}
