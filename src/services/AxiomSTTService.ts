import logger from '../utils/logger';

export interface STTResult {
  text: string;
  confidence?: number;
  duration?: number;
  provider: string;
}

export class AxiomSTTService {
  /**
   * Transcribe audio via fallback chain: Deepgram → AssemblyAI → Groq Whisper
   */
  async transcribe(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<STTResult> {
    // 1. Try Deepgram
    const deepgramKey = process.env.STT_DEEPGRAM_KEY;
    if (deepgramKey) {
      try {
        const result = await this.transcribeDeepgram(audioBuffer, mimeType, deepgramKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomSTT] Deepgram failed:', err.message);
      }
    }

    // 2. Try AssemblyAI
    const assemblyKey = process.env.STT_ASSEMBLYAI_KEY;
    if (assemblyKey) {
      try {
        const result = await this.transcribeAssemblyAI(audioBuffer, assemblyKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomSTT] AssemblyAI failed:', err.message);
      }
    }

    // 3. Try Groq Whisper (via Groq API key)
    const groqKey = process.env.GROQ_API_KEY || process.env.AI_GROQ_KEY;
    if (groqKey) {
      try {
        const result = await this.transcribeGroq(audioBuffer, groqKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomSTT] Groq Whisper failed:', err.message);
      }
    }

    throw new Error('All STT providers failed');
  }

  private async transcribeDeepgram(
    buffer: Buffer, mimeType: string, apiKey: string
  ): Promise<STTResult | null> {
    const endpoint = process.env.STT_DEEPGRAM_ENDPOINT || 'https://api.deepgram.com/v1';
    const resp = await fetch(`${endpoint}/listen?model=nova-2&smart_format=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': mimeType,
      },
      body: buffer,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const channel = data?.results?.channels?.[0];
    const text = channel?.alternatives?.[0]?.transcript;
    if (!text) return null;
    return {
      text,
      confidence: channel?.alternatives?.[0]?.confidence,
      duration: data?.metadata?.duration,
      provider: 'deepgram',
    };
  }

  private async transcribeAssemblyAI(buffer: Buffer, apiKey: string): Promise<STTResult | null> {
    // Upload
    const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { 'Authorization': apiKey },
      body: buffer,
    });
    if (!uploadResp.ok) return null;
    const { upload_url } = await uploadResp.json();

    // Transcribe
    const transcribeResp = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: upload_url }),
    });
    if (!transcribeResp.ok) return null;
    const { id } = await transcribeResp.json();

    // Poll
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'Authorization': apiKey },
      });
      if (!pollResp.ok) return null;
      const data = await pollResp.json();
      if (data.status === 'completed') {
        return { text: data.text, confidence: data.confidence, duration: data.audio_duration, provider: 'assemblyai' };
      }
      if (data.status === 'error') return null;
    }
    return null;
  }

  private async transcribeGroq(buffer: Buffer, apiKey: string): Promise<STTResult | null> {
    const model = process.env.STT_GROQ_MODEL || 'whisper-large-v3-turbo';
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', model);

    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.text) return null;
    return { text: data.text, provider: 'groq' };
  }
}

export const axiomSTTService = new AxiomSTTService();
