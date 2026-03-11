import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export interface GoalContext {
  name: string;
  domain: string;
  progress: number;
  description?: string;
  completionMetric?: string;
  targetDate?: string;
}

export interface CoachingContext {
  userName: string;
  bio?: string;
  streak: number;
  praxisPoints: number;
  goals: GoalContext[];
  recentFeedback: Array<{ grade: string; comment?: string; giverName: string; goalName: string }>;
  achievements: Array<{ goalName: string; date: string }>;
  network: any[];
  boards: any[];
}

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

const AXIOM_IDENTITY_DEFAULT = `You are Axiom — a wise, warm, and practical life coach. Your tone is friendly and direct. You give practical, concrete guidance. You never cite books by name or author. You just give people what they need to move forward.`;

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

  private async getIdentity(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'axiom_prompt')
        .single();
      
      if (error || !data) return AXIOM_IDENTITY_DEFAULT;
      return data.value;
    } catch {
      return AXIOM_IDENTITY_DEFAULT;
    }
  }

  private async listAvailableModels(key: string): Promise<string[]> {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      return (data.models || []).map((m: any) => m.name.replace('models/', ''));
    } catch {
      return [];
    }
  }

  private async runWithFallback(prompt: string): Promise<string> {
    if (this.apiKeys.length === 0) throw new Error('GEMINI_API_KEY not set.');

    const baseModels = [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash-001',
      'gemini-2.0-flash-lite-001',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
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
            try { data = JSON.parse(rawText); } catch { continue; }
            
            if (response.ok) {
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                this.currentKeyIndex = keyIdx;
                return text.trim();
              }
            }

            const errorMsg = data.error?.message || response.statusText || 'Unknown error';
            const status = response.status;
            
            if (status !== 404) {
              errors.push(`[K${keyIdx}:${keyPrefix}|${modelName}] ${status}: ${errorMsg.split('\n')[0]}`);
            }

            if (status === 429 || status === 403 || status === 401) break; 
          } catch (error: any) {
            errors.push(`[K${keyIdx}|FetchEx] ${error.message}`);
            break;
          }
        }
        const lastErr = errors[errors.length - 1];
        if (lastErr?.includes('429') || lastErr?.includes('403')) break;
      }
    }

    const discovery = await this.listAvailableModels(this.apiKeys[0]);
    const discoveredStr = discovery.length > 0 ? ` | Available: ${discovery.slice(0, 5).join(', ')}` : '';

    const uniqueErrors = Array.from(new Set(errors)).slice(0, 15).join(' | ');
    throw new Error(`Axiom remains Offline. Tried ${this.apiKeys.length} keys. Details: ${uniqueErrors}${discoveredStr}`);
  }

  public async generateFullReport(context: CoachingContext): Promise<CoachingReport> {
    const identity = await this.getIdentity();
    const prompt = `${identity}\n\nStudent: ${context.userName}\nGoals: ${JSON.stringify(context.goals)}\n\nReturn JSON: {motivation, strategy: [{goal, domain, progress, insight, steps}], network}.`;
    try {
      const text = await this.runWithFallback(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  public async generateWeeklyNarrative(stats: any): Promise<string> {
    const identity = await this.getIdentity();
    const prompt = `${identity}\n\nStats: ${JSON.stringify(stats)}\n\nWrite 2 short sentences about progress.`;
    try { return await this.runWithFallback(prompt); } 
    catch (error: any) { throw new Error(error.message); }
  }

  public async generateCoachingResponse(userPrompt: string, context: CoachingContext): Promise<string> {
    const identity = await this.getIdentity();
    const prompt = `${identity}\n\nUser: ${userPrompt}\nContext: ${JSON.stringify(context)}`;
    try { return await this.runWithFallback(prompt); } 
    catch (error: any) { throw new Error(error.message); }
  }
}
