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
  private deepseekApiKey: string | null = null;
  
  constructor() {
    // Gemini keys
    const keyString = process.env.GEMINI_API_KEY || '';
    const rawKeys = keyString.split(',');
    const cleanedKeys = rawKeys
      .map(k => k.replace(/['"\s\u200B-\u200D\uFEFF]+/g, '').trim())
      .filter(k => k.startsWith('AIza'));
    this.apiKeys = Array.from(new Set(cleanedKeys));

    // DeepSeek key
    this.deepseekApiKey = (process.env.DEEPSEEK_API_KEY || '').trim();

    if (this.apiKeys.length === 0 && !this.deepseekApiKey) {
      logger.warn('[AICoachingService] No AI keys (Gemini or DeepSeek) found.');
    } else {
      logger.info(`[AICoachingService] Active with ${this.apiKeys.length} Gemini keys and DeepSeek: ${!!this.deepseekApiKey}`);
    }
  }

  get isConfigured(): boolean {
    return this.apiKeys.length > 0 || !!this.deepseekApiKey;
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

  /**
   * Helper to attempt a generation with model fallbacks (including DeepSeek).
   */
  private async runWithFallback(
    prompt: string
  ): Promise<string> {
    const errors: string[] = [];

    // 1. Try DeepSeek first if available (often more reliable/higher quality)
    if (this.deepseekApiKey) {
      const deepseekModels = ['deepseek-chat', 'deepseek-reasoner'];
      for (const modelName of deepseekModels) {
        try {
          logger.info(`[AI Coach] Attempting DeepSeek: ${modelName}...`);
          const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.deepseekApiKey}`
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7
            })
          });

          const data = await res.json();
          if (res.ok && data.choices?.[0]?.message?.content) {
            return data.choices[0].message.content.trim();
          }
          errors.push(`[DeepSeek|${modelName}] ${res.status}: ${data.error?.message || 'Unknown error'}`);
        } catch (err: any) {
          errors.push(`[DeepSeek|${modelName}] FetchEx: ${err.message}`);
        }
      }
    }

    // 2. Fallback to Gemini keys
    if (this.apiKeys.length === 0) {
      throw new Error(`Axiom Offline. DeepSeek failed and no Gemini keys available. Errors: ${errors.join(' | ')}`);
    }

    const baseModels = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-pro', 
    ];

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

    const uniqueErrors = Array.from(new Set(errors)).slice(0, 10).join(' | ');
    throw new Error(`Axiom Offline. Details: ${uniqueErrors}`);
  }

  public async generateFullReport(context: CoachingContext): Promise<CoachingReport> {
    const identity = await this.getIdentity();
    const prompt = `${identity}\n\nStudent: ${context.userName}\nGoals: ${JSON.stringify(context.goals)}\n\nReturn JSON: {motivation, strategy: [{goal, domain, progress, insight, steps}], network}.`;
    try {
      const text = await this.runWithFallback(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (error: any) {
      logger.error('Error generating coaching report:', error.message);
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
