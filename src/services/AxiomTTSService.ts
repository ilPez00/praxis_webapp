import logger from '../utils/logger';

export interface TTSOptions {
  voice?: string;
  speed?: number;
}

export class AxiomTTSService {
  /**
   * Synthesize speech via fallback: ElevenLabs (premium) → Kokoro (local free)
   * Returns audio as base64 string with mime type.
   */
  async synthesize(text: string, options: TTSOptions = {}): Promise<{ audio: Buffer; mimeType: string; provider: string } | null> {
    // 1. Try ElevenLabs
    const elevenLabsKey = process.env.TTS_ELEVENLABS_KEY;
    if (elevenLabsKey) {
      try {
        const result = await this.synthesizeElevenLabs(text, elevenLabsKey, options);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomTTS] ElevenLabs failed:', err.message);
      }
    }

    // 2. Try Kokoro (local)
    const kokoroEndpoint = process.env.TTS_KOKORO_ENDPOINT || process.env.TTS_KOKORO_URL || 'http://localhost:8880/v1';
    try {
      const result = await this.synthesizeKokoro(text, kokoroEndpoint, options);
      if (result) return result;
    } catch (err: any) {
      logger.warn('[AxiomTTS] Kokoro failed:', err.message);
    }

    return null;
  }

  private async synthesizeElevenLabs(
    text: string, apiKey: string, options: TTSOptions
  ): Promise<{ audio: Buffer; mimeType: string; provider: string } | null> {
    const voice = options.voice || '21m00Tcm4TlvDq8ikWAM'; // Rachel (default)
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    return { audio: Buffer.from(arrayBuffer), mimeType: 'audio/mpeg', provider: 'elevenlabs' };
  }

  private async synthesizeKokoro(
    text: string, endpoint: string, options: TTSOptions
  ): Promise<{ audio: Buffer; mimeType: string; provider: string } | null> {
    const baseUrl = endpoint.replace(/\/+$/, '');
    const resp = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: options.voice || 'af_heart',
        response_format: 'mp3',
        speed: options.speed || 1.0,
      }),
    });
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    return { audio: Buffer.from(arrayBuffer), mimeType: 'audio/mpeg', provider: 'kokoro' };
  }
}

export const axiomTTSService = new AxiomTTSService();
