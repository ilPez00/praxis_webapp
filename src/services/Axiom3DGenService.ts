import logger from '../utils/logger';

export interface Model3DResult {
  modelUrl: string;
  thumbnailUrl?: string;
  provider: string;
}

export class Axiom3DGenService {
  /**
   * Generate 3D model from text prompt via fallback: Tripo3D → Meshy
   */
  async generate(prompt: string): Promise<Model3DResult | null> {
    // 1. Try Tripo3D
    const tripoKey = process.env.GEN3D_TRIPO3D_KEY;
    if (tripoKey) {
      try {
        const result = await this.generateTripo3D(prompt, tripoKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[Axiom3D] Tripo3D failed:', err.message);
      }
    }

    // 2. Try Meshy
    const meshyKey = process.env.GEN3D_MESHY_KEY;
    if (meshyKey) {
      try {
        const result = await this.generateMeshy(prompt, meshyKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[Axiom3D] Meshy failed:', err.message);
      }
    }

    return null;
  }

  private async generateTripo3D(prompt: string, apiKey: string): Promise<Model3DResult | null> {
    const endpoint = process.env.GEN3D_TRIPO3D_ENDPOINT || 'https://api.tripo3d.ai/v2/openapi';
    const resp = await fetch(`${endpoint}/text-to-model`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, negative_prompt: 'low quality, distorted' }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const taskId = data?.data?.task_id;
    if (!taskId) return null;

    // Poll for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollResp = await fetch(`${endpoint}/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();
      if (pollData?.data?.status === 'success') {
        return {
          modelUrl: pollData.data.output?.model || pollData.data.output?.obj || '',
          thumbnailUrl: pollData.data.output?.thumbnail,
          provider: 'tripo3d',
        };
      }
      if (pollData?.data?.status === 'failed') return null;
    }
    return null;
  }

  private async generateMeshy(prompt: string, apiKey: string): Promise<Model3DResult | null> {
    const endpoint = process.env.GEN3D_MESHY_ENDPOINT || 'https://api.meshy.ai/v1';
    const resp = await fetch(`${endpoint}/text-to-3d`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        art_style: 'realistic',
        negative_prompt: 'low quality, distorted',
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const taskId = data?.result?.id;
    if (!taskId) return null;

    // Poll for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollResp = await fetch(`${endpoint}/text-to-3d/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();
      if (pollData?.status === 'completed') {
        return {
          modelUrl: pollData.output?.model || pollData.output?.glb || '',
          thumbnailUrl: pollData.output?.thumbnail,
          provider: 'meshy',
        };
      }
      if (pollData?.status === 'failed') return null;
    }
    return null;
  }
}

export const axiom3DGenService = new Axiom3DGenService();
