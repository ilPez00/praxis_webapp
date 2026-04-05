import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../lib/supabaseClient';
import { EngagementMetricService, EngagementArchetype, MotivationStyle } from './EngagementMetricService';
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
  recentFeedback: Array<{ grade: string; comment?: string; giverName?: string; goalName?: string }>;
  achievements: Array<{ goalName: string; date: string }>;
  network: any[];
  boards: any[];
  // Engagement metrics (optional - if available)
  engagementMetrics?: {
    archetype: EngagementArchetype;
    motivationStyle: MotivationStyle;
    weeklyActivityScore: number;
    stagnationRisk: number;
  };
  trackerTrends?: Array<{ trackerName: string; direction: string; weekOverWeekChange: number }>;
  recentNotes?: Array<{ title?: string; content: string; mood?: string; date: string; goalName?: string }>;
  recentPlaces?: Array<{ id: string; name: string; description?: string; city?: string; domain?: string }>;
  upcomingEvents?: Array<{ id: string; title: string; description?: string; date: string; city?: string }>;
  axiomChatHistory?: Array<{ content: string; is_ai: boolean; created_at: string }>;
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
}

const AXIOM_IDENTITY_DEFAULT = `You are Axiom - a wise, warm, and highly analytical life coach. Your tone is friendly, direct, and results-oriented. 
Your primary task is to coach your student on their goals.
- You analyze recent logs, notes, and progress to find patterns.
- You identify specific bottlenecks (e.g., "you haven't logged cardio in 4 days despite your Fitness goal").
- You provide 3-5 concrete, tactical steps for each primary goal.
- You never cite books by name or author.
- Your goal is to move the needle on their structured Goal Tree.`;

const engagementMetricService = new EngagementMetricService();

/**
 * Template-based coaching responses for Minimal AI Mode.
 * Uses engagement metrics for personalization - no LLM calls.
 */
function generateTemplateMotivation(context: CoachingContext): string {
  const { engagementMetrics, streak, praxisPoints, goals } = context;
  
  // Use archetype-specific messaging if metrics available
  const archetype = engagementMetrics?.archetype;
  const motivationStyle = engagementMetrics?.motivationStyle;
  
  // Archetype-specific opening
  const archetypeOpenings: Record<string, string> = {
    consolidator: `You excel at finishing what you start.`,
    explorer: `Your curiosity is your superpower - now focus it.`,
    achiever: `Your momentum is strong. Keep building.`,
    struggler: `Every expert was once a beginner.`,
    socializer: `Your connections make you stronger.`,
    lone_wolf: `You work best when you trust your process.`,
    burnout_risk: `You've been pushing hard. Balance effort with recovery.`,
  };
  
  const opening = archetypeOpenings[archetype!] || `You're making progress.`;
  
  // Motivation style-specific encouragement
  let encouragement: string;
  switch (motivationStyle) {
    case 'streak_driven':
      encouragement = streak > 0 
        ? `Your ${streak}-day streak proves your commitment. Protect it.` 
        : `Start your streak today - every journey begins with a single step.`;
      break;
    case 'progress_focused':
      encouragement = `With ${praxisPoints.toLocaleString()} Praxis Points, you've built real momentum. Keep stacking.`;
      break;
    case 'social_accountable':
      encouragement = `Your network is here for you. Share your goals and let them support you.`;
      break;
    default:
      encouragement = streak > 0
        ? `Your ${streak}-day streak shows commitment.`
        : `Starting is the hardest part - you have already begun.`;
  }
  
  const goalCount = goals.length;
  const activeGoals = goals.filter(g => g.progress < 100).length;
  
  return `${opening} ${encouragement} You're tracking ${goalCount} goals (${activeGoals} active). Focus on one meaningful action today.`;
}

function generateTemplateStrategy(context: CoachingContext): CoachingReport['strategy'] {
  const { engagementMetrics, goals } = context;
  const stagnationRisk = engagementMetrics?.stagnationRisk ?? 50;
  
  return goals.slice(0, 3).map(goal => {
    const progressBucket = goal.progress < 25 ? 'just starting'
      : goal.progress < 50 ? 'building momentum'
      : goal.progress < 75 ? 'making great progress'
      : 'in the final stretch';

    // Adjust advice based on stagnation risk
    let nextStep: string;
    if (stagnationRisk > 60) {
      // High stagnation: suggest tiny actions
      nextStep = goal.progress < 25
        ? 'Commit to just 2 minutes on this today.'
        : 'What is the absolute smallest next step? Do that.';
    } else {
      // Normal: standard advice
      nextStep = goal.progress < 25
        ? 'Define one small, concrete action you can take today.'
        : goal.progress < 50
        ? 'Identify the biggest obstacle right now and tackle it first.'
        : goal.progress < 75
        ? 'Review what is working well and double down on it.'
        : 'Plan your final push - what is the last 10% that completes this?';
    }

    return {
      goal: goal.name,
      domain: goal.domain,
      progress: goal.progress,
      insight: `You're ${progressBucket} on this goal.`,
      steps: [nextStep, 'Schedule it in your calendar.', 'Celebrate when done.'],
    };
  });
}

function generateTemplateReport(context: CoachingContext): CoachingReport {
  return {
    motivation: generateTemplateMotivation(context),
    strategy: generateTemplateStrategy(context),
  };
}

function generateTemplateWeeklyNarrative(stats: any): string {
  const lang = stats.language || 'en';
  const checkins = stats.checkinsThisWeek || 0;
  const goalsUpdated = stats.goalsUpdatedThisWeek || 0;
  
  if (lang === 'it') {
    return `Questa settimana hai fatto ${checkins} check-in e aggiornato ${goalsUpdated} obiettivi. Continua così!`;
  }
  if (lang === 'es') {
    return `Esta semana hiciste ${checkins} check-ins y actualizaste ${goalsUpdated} objetivos. ¡Sigue así!`;
  }
  if (lang === 'fr') {
    return `Cette semaine, vous avez fait ${checkins} check-ins et mis à jour ${goalsUpdated} objectifs. Continuez comme ça !`;
  }
  return `This week you logged ${checkins} check-ins and updated ${goalsUpdated} goals. Small steps, big progress. Keep going!`;
}

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
  public async runWithFallback(
    prompt: string
  ): Promise<string> {
    const errors: string[] = [];

    // 1. Try DeepSeek first - cheapest per token when key is configured
    if (this.deepseekApiKey) {
      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.deepseekApiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1500,
          }),
        });
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (response.ok && text) return text;
        errors.push(`[DeepSeek] ${response.status}`);
      } catch (err: any) {
        errors.push(`[DeepSeek] FetchEx`);
      }
    }

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

    // Ordered by rate limit (highest first) and cost
    // gemini-2.5-flash: Newest, highest free tier limits (recommended)
    // gemini-2.0-flash: Standard flash model, good limits
    // gemini-2.5-pro: Pro tier, highest limits but more expensive
    // gemini-1.5-flash: Older, lower limits
    // gemini-1.5-flash-8b: 8B model, cheapest but lowest limits
    // gemini-2.0-flash-lite: Lowest limits (avoid for bulk operations)
    const baseModels = [
      'gemini-2.5-flash',      // ← Try newest first (highest limits)
      'gemini-2.0-flash',      // ← Standard flash
      'gemini-2.5-pro',        // ← Pro tier
      'gemini-1.5-flash',      // ← Older flash
      'gemini-1.5-flash-8b',   // ← 8B cheap model
      'gemini-2.0-flash-lite', // ← Last resort (lowest limits)
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
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 150));
            
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

  /**
   * Generate full coaching report.
   * @param context - User context
   * @param useLLM - If true, use real LLM (Axiom Boost / premium feature). Default: false (template mode)
   */
  public async generateFullReport(context: CoachingContext, useLLM: boolean = false): Promise<CoachingReport> {
    // Minimal AI Mode: use templates by default
    if (!useLLM) {
      logger.info('[AICoachingService] Using template-based report (Minimal AI Mode)');
      const template = generateTemplateReport(context);
      return {
        motivation: template.motivation,
        strategy: template.strategy
      };
    }

    // Premium "Axiom Boost" - real LLM call
    logger.info('[AICoachingService] Using LLM for premium report (Axiom Boost)');
    const identity = await this.getIdentity();
    
    const contextData = {
      student: context.userName,
      goals: context.goals,
      recentNotes: (context.recentNotes || []).slice(0, 5),
      recentActivity: context.trackerTrends || [],
      achievements: context.achievements || []
    };

    const prompt = `${identity}
Language: ${context.language}
Student Context: ${JSON.stringify(contextData)}

Formulate a deep strategic analysis. For the 'strategy' array, pick the 3 most important goals. 
For each goal, provide:
1. 'insight': A 2-sentence analysis of their current pace and obstacles based on their logs/notes.
2. 'steps': 3-5 high-impact, specific actions they should take in the next 48 hours.

Respond ONLY with this JSON structure:
{
  "motivation": "A warm, high-energy 2-sentence opening acknowledging their recent wins/mindset.",
  "strategy": [
    {
      "goal": "Name",
      "domain": "Domain",
      "progress": 0,
      "insight": "Deep analysis...",
      "steps": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}
Respond in ${context.language}.`;

    try {
      const text = await this.runWithFallback(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      
      return {
        motivation: result.motivation,
        strategy: result.strategy || []
      };
    } catch (error: any) {
      logger.error('Error generating coaching report:', error.message);
      // Fallback to template if LLM fails
      const template = generateTemplateReport(context);
      return {
        motivation: template.motivation,
        strategy: template.strategy
      };
    }
  }

  /**
   * Generate weekly narrative recap.
   * @param stats - Weekly stats
   * @param useLLM - If true, use real LLM. Default: false (template mode)
   */
  public async generateWeeklyNarrative(stats: any, useLLM: boolean = false): Promise<string> {
    // Minimal AI Mode: use templates by default
    if (!useLLM) {
      logger.info('[AICoachingService] Using template-based weekly narrative (Minimal AI Mode)');
      return generateTemplateWeeklyNarrative(stats);
    }

    // Premium - real LLM call
    logger.info('[AICoachingService] Using LLM for premium weekly narrative');
    const identity = await this.getIdentity();
    const lang = stats.language || 'en';
    const prompt = `${identity}\nStats: ${JSON.stringify(stats)}\nWrite 2 concise sentences on progress in ${lang}.`;
    try { 
      return await this.runWithFallback(prompt); 
    } catch (error: any) { 
      logger.error('Error generating weekly narrative:', error.message);
      // Fallback to template if LLM fails
      return generateTemplateWeeklyNarrative(stats);
    }
  }

  /**
   * Model tier selection for different query types
   * 'fast' - gemini-2.0-flash-lite for simple queries (cheapest)
   * 'analysis' - gemini-2.5-flash for complex morning briefs
   */
  public static MODEL_TIERS = {
    fast: ['gemini-2.0-flash-lite', 'gemini-1.5-flash-8b', 'gemini-1.5-flash'],
    analysis: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'],
  };

  /**
   * Generate coaching response to user prompt.
   * @param userPrompt - User's question/message
   * @param context - User context
   * @param useLLM - If true, use real LLM (premium). Default: false (template mode)
   * @param modelTier - 'fast' for simple queries, 'analysis' for complex briefs (default: 'analysis')
   */
  public async generateCoachingResponse(
    userPrompt: string, 
    context: CoachingContext, 
    useLLM: boolean = false,
    modelTier: 'fast' | 'analysis' = 'analysis'
  ): Promise<string> {
    // Minimal AI Mode: use template-based response
    if (!useLLM) {
      logger.info('[AICoachingService] Using template-based response (Minimal AI Mode)');
      // Simple template: acknowledge + encourage + suggest action
      const goalCount = context.goals.length;
      const streakMsg = context.streak > 0 ? `Your ${context.streak}-day streak shows commitment.` : 'Starting is the hardest part - you have already begun.';
      return `${streakMsg} With ${goalCount} goals in focus, try this: pick ONE small action today that moves the needle. Progress compounds.`;
    }

    // Premium - real LLM call
    logger.info(`[AICoachingService] Using LLM (${modelTier} tier) for premium coaching response`);
    
    // Override model selection based on tier
    const originalBaseModels = AICoachingService.MODEL_TIERS.analysis;
    const tierModels = AICoachingService.MODEL_TIERS[modelTier] || AICoachingService.MODEL_TIERS.analysis;
    
    // Store and restore model order to respect tier selection
    const identity = await this.getIdentity();

    const knowledgeBase = `
You have access to the following knowledge about this user and the Praxis ecosystem. Reference them naturally when relevant:

- **Notebook / Notes**: The user's personal reflections and journal entries. Use these to understand their mindset, struggles, and wins.
${context.recentNotes && context.recentNotes.length > 0 ? context.recentNotes.map(n => `  - "${n.title || 'Note'}" (${n.date}): ${(n.content || '').slice(0, 120)}`).join('\n') : '  (No recent notes)'}

- **People / Network**: Accountability partners and matches the user is connected with. Suggest reaching out when relevant.
${context.network && context.network.length > 0 ? context.network.map(n => `  - ${n.name} (domains: ${(n.domains || []).join(', ') || 'general'})`).join('\n') : '  (No connections yet)'}

- **Places Nearby**: Physical locations relevant to the user's goals or city.
${context.recentPlaces && context.recentPlaces.length > 0 ? context.recentPlaces.map(p => `  - ${p.name}${p.city ? ' (' + p.city + ')' : ''}${p.domain ? ' [' + p.domain + ']' : ''}`).join('\n') : '  (No places available)'}

- **Upcoming Events**: Events the user might want to attend or participate in.
${context.upcomingEvents && context.upcomingEvents.length > 0 ? context.upcomingEvents.map(e => `  - "${e.title}" on ${e.date}${e.city ? ' in ' + e.city : ''}`).join('\n') : '  (No upcoming events)'}

- **Community Boards**: Groups the user has joined for accountability and discussion.
${context.boards && context.boards.length > 0 ? context.boards.map(b => `  - ${b.name}${b.domain ? ' [' + b.domain + ']' : ''}`).join('\n') : '  (No boards joined)'}

- **Goal Tree**: The user's structured goals with progress tracking.
${context.goals && context.goals.length > 0 ? context.goals.map(g => `  - "${g.name}" (${g.domain}) — ${g.progress}% complete`).join('\n') : '  (No goals set)'}

- **Recent Axiom Conversation**: Previous messages between you (Axiom) and this user. Use for continuity.
${context.axiomChatHistory && context.axiomChatHistory.length > 0 ? context.axiomChatHistory.slice(0, 5).map(m => `  - [${m.is_ai ? 'Axiom' : 'User'}]: ${(m.content || '').slice(0, 100)}`).join('\n') : '  (No prior conversation)'}

When answering, naturally weave in references to their notes, goals, network, places, events, or boards when it adds value. Do not list everything — pick what is most relevant to their question.`;

    const prompt = `${identity}\n${knowledgeBase}\nUser: ${userPrompt}\nReply concisely in ${context.language}.`;
    try { 
      return await this.runWithFallback(prompt); 
    } catch (error: any) { 
      logger.error('Error generating coaching response:', error.message);
      // Fallback to template if LLM fails
      return "Thanks for sharing. What's one small step you could take today toward your most important goal?";
    }
  }
}
