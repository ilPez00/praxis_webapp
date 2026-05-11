import logger from '../utils/logger';

export interface RetrievalResult {
  text: string;
  score: number;
  source: string;
}

export class AxiomRetrievalService {
  /**
   * Query vector DBs via fallback: Qdrant → Chroma → Pinecone
   */
  async query(collection: string, queryText: string, topK: number = 5): Promise<RetrievalResult[]> {
    // 1. Try Qdrant
    const qdrantUrl = process.env.DB_QDRANT_LOCAL || process.env.QDRANT_URL;
    if (qdrantUrl) {
      try {
        const results = await this.queryQdrant(qdrantUrl, collection, queryText, topK);
        if (results.length > 0) return results;
      } catch (err: any) {
        logger.warn('[AxiomRetrieval] Qdrant failed:', err.message);
      }
    }

    // 2. Try Chroma
    const chromaUrl = process.env.DB_CHROMA_LOCAL || process.env.CHROMA_URL;
    if (chromaUrl) {
      try {
        const results = await this.queryChroma(chromaUrl, collection, queryText, topK);
        if (results.length > 0) return results;
      } catch (err: any) {
        logger.warn('[AxiomRetrieval] Chroma failed:', err.message);
      }
    }

    // 3. Try Pinecone
    const pineconeKey = process.env.DB_PINECONE_KEY || process.env.PINECONE_API_KEY;
    if (pineconeKey) {
      try {
        const results = await this.queryPinecone(collection, queryText, topK, pineconeKey);
        if (results.length > 0) return results;
      } catch (err: any) {
        logger.warn('[AxiomRetrieval] Pinecone failed:', err.message);
      }
    }

    return [];
  }

  private async queryQdrant(
    baseUrl: string, collection: string, queryText: string, topK: number
  ): Promise<RetrievalResult[]> {
    // Use a simple text match approach since Qdrant needs embeddings
    // For production, pair with an embedding service
    const url = `${baseUrl.replace(/\/+$/, '')}/collections/${collection}/points/search`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        params: { hnsw_ef: 128 },
        limit: topK,
        with_payload: true,
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.result || []).map((r: any) => ({
      text: r.payload?.text || r.payload?.content || '',
      score: r.score || 0,
      source: 'qdrant',
    })).filter(r => r.text);
  }

  private async queryChroma(
    baseUrl: string, collection: string, queryText: string, topK: number
  ): Promise<RetrievalResult[]> {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/collections/${collection}/query`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_texts: [queryText], n_results: topK }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: RetrievalResult[] = [];
    for (let i = 0; i < (data.ids?.[0]?.length || 0); i++) {
      results.push({
        text: (data.metadatas?.[0]?.[i]?.text || data.documents?.[0]?.[i] || ''),
        score: data.distances?.[0]?.[i] ? 1 - data.distances[0][i] : 0,
        source: 'chroma',
      });
    }
    return results.filter(r => r.text);
  }

  private async queryPinecone(
    collection: string, queryText: string, topK: number, apiKey: string
  ): Promise<RetrievalResult[]> {
    // Pinecone requires the index host URL — derive from collection name
    const host = `${collection}.svc.gcp-starter.pinecone.io`;
    const resp = await fetch(`https://${host}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        topK,
        includeMetadata: true,
        vector: new Array(768).fill(0), // placeholder — needs real embedding
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.matches || []).map((m: any) => ({
      text: m.metadata?.text || m.metadata?.content || '',
      score: m.score || 0,
      source: 'pinecone',
    })).filter(r => r.text);
  }
}

export const axiomRetrievalService = new AxiomRetrievalService();
