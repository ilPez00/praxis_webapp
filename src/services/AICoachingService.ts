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
const AXIOM_IDENTITY = `You are Axiom — a wise, warm, and practical life coach. Your tone is friendly and direct. You give practical, concrete guidance. You never cite books by name or author. You just give people what they need to move forward.`;

export class AICoachingService {
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;
  
  constructor() {
    const keyString = process.env.GEMINI_API_KEY || '';
    const rawKeys = keyString.split(',');
    const cleanedKeys = rawKeys
      .map(k => k.replace(/['"\s\u200B-\u200D\uFEFF]+/g, '').trim())
      .filter(k => k.startsWith('AIza'));
    this.apiKeys = Array.from(new Set(cleanedKeys));

    if (this.apiKeys.length === 0) {
      logger.warn('[AICoachingService] No valid GEMINI_API_KEY found.');
    } else {
      logger.info(`[AICoachingService] Active with ${this.apiKeys.length} unique keys.`);
    }
  }

  get isConfigured(): boolean {
    return this.apiKeys.length > 0;
  }

  private rotateKey() {
    if (this.apiKeys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    }
  }

  private async runWithFallback(prompt: string): Promise<string> {
    if (this.apiKeys.length === 0) throw new Error('GEMINI_API_KEY not set.');

    // Comprehensive list of models to try
    const baseModels = [
      'gemini-1.5-flash-8b', // Highly available
      'gemini-1.5-flash',
      'gemini-pro',          // Legacy 1.0 (most compatible)
      'gemini-1.5-pro',
      'gemini-2.0-flash',
    ];
    
    const errors: string[] = [];
    const triedKeys = new Set<number>();

    for (let i = 0; i < this.apiKeys.length; i++) {
      const keyIdx = (this.currentKeyIndex + i) % this.apiKeys.length;
      if (triedKeys.has(keyIdx)) continue;
      triedKeys.add(keyIdx);

      const key = this.apiKeys[keyIdx];
      const keyPrefix = key?.slice(0, 6) || '????';

      for (const modelName of baseModels) {
        for (const apiVersion of ['v1beta', 'v1'] as const) {
          try {
            const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${key}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const rawText = await response.text();
            let data: any;
            try { 
              data = JSON.parse(rawText); 
            } catch { 
              errors.push(`[K${keyIdx}|${modelName}] Non-JSON response`);
              continue; 
            }
            
            if (response.ok) {
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                this.currentKeyIndex = keyIdx;
                return text.trim();
              }
            }

            const errorMsg = data.error?.message || response.statusText || 'Unknown error';
            const status = response.status;
            
            errors.push(`[K${keyIdx}:${keyPrefix}|${modelName}] ${status}: ${errorMsg.split('\n')[0]}`);

            // If key is exhausted (429) or forbidden (403/401), stop trying models for this key
            if (status === 429 || status === 403 || status === 401) {
              break; 
            }
          } catch (error: any) {
            errors.push(`[K${keyIdx}|FetchEx] ${error.message}`);
            break;
          }
        }
        // If the key is exhausted, move to next key immediately
        const lastErr = errors[errors.length - 1];
        if (lastErr?.includes('429') || lastErr?.includes('403') || lastErr?.includes('401')) break;
      }
    }

    const uniqueErrors = Array.from(new Set(errors)).slice(0, 15).join(' | ');
    throw new Error(`Axiom remains Offline. Details: ${uniqueErrors}`);
  }

  public async generateFullReport(context: CoachingContext): Promise<CoachingReport> {
    const prompt = this.buildReportPrompt(context);
    try {
      const text = await this.runWithFallback(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleaned = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(cleaned) as CoachingReport;
    } catch (error: any) {
      logger.error('Error generating coaching report:', error.message);
      throw new Error(error.message);
    }
  }

  public async generateWeeklyNarrative(stats: any): Promise<string> {
    const prompt = `${AXIOM_IDENTITY}\n\nUser stats: ${JSON.stringify(stats)}\n\nWrite 2 short sentences in Axiom's voice about their progress.`;
    try { return await this.runWithFallback(prompt); } 
    catch (error: any) { throw new Error(error.message); }
  }

  public async generateCoachingResponse(userPrompt: string, context: CoachingContext): Promise<string> {
    const prompt = `${AXIOM_IDENTITY}\n\nContext: ${JSON.stringify(context)}\n\nUser asks: "${userPrompt}"\n\nRespond as Axiom.`;
    try { return await this.runWithFallback(prompt); } 
    catch (error: any) { throw new Error(error.message); }
  }

  private buildReportPrompt(ctx: CoachingContext): string {
    return `${AXIOM_IDENTITY}\n\nStudent: ${ctx.userName}\nGoals: ${JSON.stringify(ctx.goals)}\n\nReturn valid JSON with keys: motivation (string), strategy (array of {goal, domain, progress, insight, steps}), network (string).`;
  }
}
