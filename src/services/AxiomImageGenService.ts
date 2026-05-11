import logger from '../utils/logger';

export interface ImageGenResult {
  imageUrl: string;
  provider: string;
  revisedPrompt?: string;
}

export class AxiomImageGenService {
  /**
   * Generate image via fallback: Pollinations (free) → Pixazo → Wavespeed
   */
  async generate(prompt: string, options: { width?: number; height?: number } = {}): Promise<ImageGenResult | null> {
    const { width = 1024, height = 1024 } = options;

    // 1. Pollinations (free, no key required)
    try {
      const url = process.env.IMAGE_POLLINATIONS_URL || 'https://image.pollinations.ai/prompt';
      const encoded = encodeURIComponent(prompt);
      const imageUrl = `${url}/${encoded}?width=${width}&height=${height}&nologo=true`;
      // Validate the URL works
      const head = await fetch(imageUrl, { method: 'HEAD' });
      if (head.ok) {
        logger.info('[AxiomImageGen] Pollinations generated image');
        return { imageUrl, provider: 'pollinations' };
      }
    } catch (err: any) {
      logger.warn('[AxiomImageGen] Pollinations failed:', err.message);
    }

    // 2. Pixazo
    const pixazoKey = process.env.IMAGE_PIXAZO_KEY;
    const pixazoEndpoint = process.env.IMAGE_PIXAZO_ENDPOINT || 'https://gateway.pixazo.ai/v2';
    if (pixazoKey) {
      try {
        const resp = await fetch(`${pixazoEndpoint}/images/generations`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${pixazoKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, n: 1, size: `${width}x${height}` }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const imageUrl = data?.data?.[0]?.url;
          if (imageUrl) return { imageUrl, provider: 'pixazo' };
        }
      } catch (err: any) {
        logger.warn('[AxiomImageGen] Pixazo failed:', err.message);
      }
    }

    // 3. Wavespeed
    const wavespeedKey = process.env.IMAGE_WAVESPEED_KEY;
    const wavespeedEndpoint = process.env.IMAGE_WAVESPEED_ENDPOINT || 'https://api.wavespeed.ai/api/v2';
    if (wavespeedKey) {
      try {
        const resp = await fetch(`${wavespeedEndpoint}/image/generate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${wavespeedKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, width, height }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const imageUrl = data?.url || data?.data?.url;
          if (imageUrl) return { imageUrl, provider: 'wavespeed' };
        }
      } catch (err: any) {
        logger.warn('[AxiomImageGen] Wavespeed failed:', err.message);
      }
    }

    return null;
  }
}

export const axiomImageGenService = new AxiomImageGenService();
