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
  language: string;
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

    // Load balancing: pick a random starting key to distribute usage across projects
    if (this.apiKeys.length > 0) {
      this.currentKeyIndex = Math.floor(Math.random() * this.apiKeys.length);
    }

    // DeepSeek key
    this.deepseekApiKey = (process.env.DEEPSEEK_API_KEY || '').trim();

    if (this.apiKeys.length === 0 && !this.deepseekApiKey) {
      logger.warn('[AICoachingService] No AI keys (Gemini or DeepSeek) found.');
    } else {
      logger.info(`[AICoachingService] Ready. Start Key: ${this.currentKeyIndex}. DeepSeek: ${!!this.deepseekApiKey}`);
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
   * Diagnostic: Lists all models available for the current key.
   */
  private async listAvailableModels(key: string): Promise<string[]> {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      return (data.models || []).map((m: any) => m.name.replace('models/', ''));
    } catch {
      return [];
    }
  }

  private async getStrategy(): Promise<'first' | 'last' | 'random'> {
    try {
      const { data } = await supabase.from('system_config').select('value').eq('key', 'axiom_key_strategy').single();
      if (data?.value === 'first' || data?.value === 'last' || data?.value === 'random') {
        return data.value as any;
      }
      return 'random';
    } catch {
      return 'random';
    }
  }

  /**
   * Helper to attempt a generation with model fallbacks (including DeepSeek).
   */
  private async runWithFallback(
    prompt: string
  ): Promise<string> {
    const errors: string[] = [];

    // ... (DeepSeek logic remains same)

    // 2. Fallback to Gemini keys pool
    if (this.apiKeys.length === 0) {
      throw new Error(`Axiom Offline. No Gemini keys available.`);
    }

    // Determine starting index based on Admin preference
    const strategy = await this.getStrategy();
    let startIndex = this.currentKeyIndex; // default to the instance's random start
    if (strategy === 'first') startIndex = 0;
    if (strategy === 'last') startIndex = this.apiKeys.length - 1;
    if (strategy === 'random') startIndex = Math.floor(Math.random() * this.apiKeys.length);

    const baseModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-pro',
    ];

    const triedKeys = new Set<number>();

    for (let i = 0; i < this.apiKeys.length; i++) {
      const keyIdx = (startIndex + i) % this.apiKeys.length;
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
            try { data = JSON.parse(rawText); } catch { errors.push(`[K${keyIdx}|${modelName}] Non-JSON`); continue; }
            
            if (response.ok) {
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                this.currentKeyIndex = keyIdx;
                return text.trim();
              }
            }

            const status = response.status;
            // Record result for this specific key
            errors.push(`[K${keyIdx}:${keyPrefix}|${modelName}] ${status}`);

            if (status === 429 || status === 403 || status === 401) break; 
          } catch (error: any) {
            errors.push(`[K${keyIdx}|FetchEx]`);
            break;
          }
        }
        const lastErr = errors[errors.length - 1];
        if (lastErr?.includes('429') || lastErr?.includes('403') || lastErr?.includes('401')) break;
      }
    }

    // Optional Discovery log if all failed
    let discovered = '';
    try { discovered = ` | Available: ${(await this.listAvailableModels(this.apiKeys[0])).slice(0, 3).join(',')}`; } catch {}

    const uniqueErrors = Array.from(new Set(errors)).slice(0, 15).join(' | ');
    throw new Error(`Axiom Offline. Tried ${this.apiKeys.length} keys. Status: ${uniqueErrors}${discovered}`);
  }

  public async generateFullReport(context: CoachingContext): Promise<CoachingReport> {
    const identity = await this.getIdentity();
    const prompt = `${identity}\nStudent: ${context.userName}\nLanguage: ${context.language}\nGoals: ${JSON.stringify(context.goals)}\nActionable JSON: {motivation, strategy: [{goal, domain, progress, insight, steps}], network}. Respond concise in ${context.language}.`;
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
    const lang = stats.language || 'en';
    const prompt = `${identity}\nStats: ${JSON.stringify(stats)}\nWrite 2 concise sentences on progress in ${lang}.`;
    try { return await this.runWithFallback(prompt); } 
    catch (error: any) { throw new Error(error.message); }
  }

  public async generateCoachingResponse(userPrompt: string, context: CoachingContext): Promise<string> {
    const identity = await this.getIdentity();
    const prompt = `${identity}\n\nUser: ${userPrompt}\nContext: ${JSON.stringify(context)}\n\nIMPORTANT: Respond in the following language: ${context.language}.`;
    try { return await this.runWithFallback(prompt); } 
    catch (error: any) { throw new Error(error.message); }
  }
}
