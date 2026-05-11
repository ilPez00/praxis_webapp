import logger from '../utils/logger';

export interface MemoryEntry {
  id: string;
  text: string;
  score?: number;
  createdAt?: string;
  categories?: string[];
}

export class AxiomMemoryService {
  /**
   * Store a memory via Mem0 or Zep
   */
  async store(userId: string, text: string, categories?: string[]): Promise<boolean> {
    // 1. Try Mem0
    const mem0Key = process.env.MEMORY_MEM0_KEY;
    if (mem0Key) {
      try {
        await this.storeMem0(userId, text, categories, mem0Key);
        return true;
      } catch (err: any) {
        logger.warn('[AxiomMemory] Mem0 store failed:', err.message);
      }
    }

    // 2. Try Zep
    const zepUrl = process.env.MEMORY_ZEP_LOCAL || process.env.MEMORY_ZEP_ENDPOINT;
    if (zepUrl) {
      try {
        await this.storeZep(userId, text, categories, zepUrl);
        return true;
      } catch (err: any) {
        logger.warn('[AxiomMemory] Zep store failed:', err.message);
      }
    }

    return false;
  }

  /**
   * Search memories for a user
   */
  async search(userId: string, query: string, limit: number = 5): Promise<MemoryEntry[]> {
    // 1. Try Zep (better search)
    const zepUrl = process.env.MEMORY_ZEP_LOCAL || process.env.MEMORY_ZEP_ENDPOINT;
    if (zepUrl) {
      try {
        const results = await this.searchZep(userId, query, limit, zepUrl);
        if (results.length > 0) return results;
      } catch (err: any) {
        logger.warn('[AxiomMemory] Zep search failed:', err.message);
      }
    }

    // 2. Try Mem0
    const mem0Key = process.env.MEMORY_MEM0_KEY;
    if (mem0Key) {
      try {
        const results = await this.searchMem0(userId, query, limit, mem0Key);
        if (results.length > 0) return results;
      } catch (err: any) {
        logger.warn('[AxiomMemory] Mem0 search failed:', err.message);
      }
    }

    return [];
  }

  private async storeMem0(userId: string, text: string, categories: string[] | undefined, apiKey: string): Promise<void> {
    await fetch('https://api.mem0.ai/v1/memories/', {
      method: 'POST',
      headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        text,
        metadata: { categories: categories || [] },
      }),
    });
  }

  private async searchMem0(userId: string, query: string, limit: number, apiKey: string): Promise<MemoryEntry[]> {
    const resp = await fetch(`https://api.mem0.ai/v1/memories/?user_id=${userId}&query=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || []).map((m: any) => ({
      id: m.id || '',
      text: m.text || m.memory || '',
      score: m.score || 0,
      createdAt: m.created_at,
    })).filter(m => m.text);
  }

  private async storeZep(userId: string, text: string, _categories: string[] | undefined, baseUrl: string): Promise<void> {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/sessions/${userId}/memory`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        summary: { text },
      }),
    });
  }

  private async searchZep(userId: string, query: string, limit: number, baseUrl: string): Promise<MemoryEntry[]> {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/sessions/${userId}/search`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query, limit }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || []).map((m: any) => ({
      id: m.id || '',
      text: m.message?.content || m.content || '',
      score: m.score || 0,
      createdAt: m.created_at,
    })).filter(m => m.text);
  }
}

export const axiomMemoryService = new AxiomMemoryService();
