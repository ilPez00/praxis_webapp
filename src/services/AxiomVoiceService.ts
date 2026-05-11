import logger from '../utils/logger';

export interface VoiceRoomResult {
  roomUrl: string;
  roomName: string;
  provider: string;
}

export class AxiomVoiceService {
  /**
   * Create a voice room via LiveKit or Daily
   */
  async createRoom(roomName?: string): Promise<VoiceRoomResult | null> {
    // 1. Try LiveKit
    const livekitEndpoint = process.env.VOICE_LIVEKIT_ENDPOINT;
    const livekitKey = process.env.LIVEKIT_API_KEY;
    const livekitSecret = process.env.LIVEKIT_API_SECRET;
    if (livekitEndpoint && livekitKey && livekitSecret) {
      try {
        const result = await this.createLiveKitRoom(roomName, livekitEndpoint, livekitKey, livekitSecret);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomVoice] LiveKit failed:', err.message);
      }
    }

    // 2. Try Daily
    const dailyKey = process.env.VOICE_DAILY_KEY;
    const dailyEndpoint = process.env.VOICE_DAILY_ENDPOINT || 'https://api.daily.co/v1';
    if (dailyKey) {
      try {
        const result = await this.createDailyRoom(roomName, dailyEndpoint, dailyKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomVoice] Daily failed:', err.message);
      }
    }

    return null;
  }

  private async createLiveKitRoom(
    roomName: string | undefined, _endpoint: string, _apiKey: string, _apiSecret: string
  ): Promise<VoiceRoomResult | null> {
    // LiveKit requires server-side token generation
    // For now, create via REST if available
    try {
      const resp = await fetch(`${_endpoint.replace(/\/+$/, '')}/api/v1/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName || `axiom-${Date.now()}`, empty_timeout: 300 }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return {
        roomUrl: `https://${new URL(_endpoint).hostname}/rooms/${data.name}`,
        roomName: data.name,
        provider: 'livekit',
      };
    } catch {
      return null;
    }
  }

  private async createDailyRoom(
    roomName: string | undefined, endpoint: string, apiKey: string
  ): Promise<VoiceRoomResult | null> {
    const resp = await fetch(`${endpoint.replace(/\/+$/, '')}/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roomName || undefined,
        privacy: 'public',
        properties: { enable_prejoin_ui: true, enable_chat: true },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      roomUrl: data.url,
      roomName: data.name,
      provider: 'daily',
    };
  }
}

export const axiomVoiceService = new AxiomVoiceService();
