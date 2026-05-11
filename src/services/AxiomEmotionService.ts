import logger from '../utils/logger';

export interface EmotionResult {
  emotions: Array<{ name: string; score: number }>;
  topEmotion: string;
  provider: string;
}

export class AxiomEmotionService {
  /**
   * Analyze emotional content of text via Hume AI (fallback to keyword-based)
   */
  async analyze(text: string): Promise<EmotionResult> {
    // 1. Try Hume AI
    const humeKey = process.env.EMOTION_HUME_KEY;
    if (humeKey) {
      try {
        const result = await this.analyzeHume(text, humeKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomEmotion] Hume failed:', err.message);
      }
    }

    // 2. Local keyword-based fallback
    return this.analyzeLocal(text);
  }

  private async analyzeHume(text: string, apiKey: string): Promise<EmotionResult | null> {
    const endpoint = process.env.EMOTION_HUME_ENDPOINT || 'https://api.hume.ai/v0';
    const resp = await fetch(`${endpoint}/batches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Hume-Api-Key': apiKey,
      },
      body: JSON.stringify({
        models: { language: {} },
        urls: [],
        text: [text],
      }),
    });
    if (!resp.ok) return null;

    // Hume batch API is async — poll for results
    const { job_id } = await resp.json();
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(`${endpoint}/batches/${job_id}`, {
        headers: { 'Accept': 'application/json', 'X-Hume-Api-Key': apiKey },
      });
      if (!pollResp.ok) continue;
      const data = await pollResp.json();
      if (data.state === 'COMPLETED') {
        const predictions = data?.predictions?.[0]?.results?.language?.predictions?.[0]?.emotions || [];
        const emotions = predictions.map((e: any) => ({ name: e.name, score: e.score }));
        const top = emotions.sort((a: any, b: any) => b.score - a.score)[0];
        return { emotions, topEmotion: top?.name || 'neutral', provider: 'hume' };
      }
      if (data.state === 'FAILED') return null;
    }
    return null;
  }

  private analyzeLocal(text: string): EmotionResult {
    const keywords: Record<string, string[]> = {
      joy: ['happy', 'great', 'wonderful', 'amazing', 'love', 'excited', 'grateful', 'awesome', 'fantastic', 'blessed'],
      sadness: ['sad', 'unhappy', 'depressed', 'down', 'cry', 'lonely', 'heartbroken', 'grief', 'miserable'],
      anger: ['angry', 'furious', 'outraged', 'hate', 'annoyed', 'frustrated', 'irritated', 'mad'],
      fear: ['scared', 'afraid', 'anxious', 'worried', 'terrified', 'nervous', 'panicked', 'dread'],
      surprise: ['shocked', 'surprised', 'amazed', 'stunned', 'unexpected', 'astonished'],
      disgust: ['disgusted', 'gross', 'repulsed', 'horrified', 'revolted'],
      neutral: [],
    };

    const lower = text.toLowerCase();
    const scores: Record<string, number> = {};
    for (const [emotion, words] of Object.entries(keywords)) {
      scores[emotion] = words.reduce((sum, w) => sum + (lower.includes(w) ? 1 : 0), 0);
    }

    const emotions = Object.entries(scores)
      .filter(([, s]) => s > 0)
      .map(([name, score]) => ({ name, score: score / Math.max(...Object.values(scores), 1) }));

    const topEmotion = emotions.length > 0
      ? emotions.sort((a, b) => b.score - a.score)[0].name
      : 'neutral';

    return { emotions, topEmotion, provider: 'local' };
  }
}

export const axiomEmotionService = new AxiomEmotionService();
