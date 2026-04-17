/**
 * Axiom Multimodal Service
 * Fetches notebook attachments, encodes them, and prepares for Gemini
 * Supports: images (base64), PDFs (text extraction), text files, links
 */

import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Attachment {
  type: 'file' | 'link';
  url: string;
  name: string;
  mimeType?: string;
}

export interface MultimodalPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;  // base64
  };
}

// ---------------------------------------------------------------------------
// MIME type mapping — frontend → Gemini-supported
// ---------------------------------------------------------------------------

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
  'application/pdf': 'application/pdf',
  'text/plain': 'text/plain',
  'application/json': 'application/json',
};

function mapMimeType(mimeType: string | undefined): string | null {
  if (!mimeType) return null;
  return SUPPORTED_MIME_TYPES[mimeType.toLowerCase()] || null;
}

// ---------------------------------------------------------------------------
// Fetch + encode helpers
// ---------------------------------------------------------------------------

async function fetchFileAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/octet-stream' },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      logger.warn(`[AxiomMultimodal] Fetch failed ${response.status} for ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return { base64, mimeType };
  } catch (err: any) {
    logger.warn(`[AxiomMultimodal] Fetch error for ${url}: ${err.message}`);
    return null;
  }
}

async function extractTextFromPdf(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const pdfParse = (await import('pdf-parse')).default;
    const pdfData = await pdfParse(Buffer.from(arrayBuffer));

    const text = pdfData.text?.trim();
    if (!text) return null;

    // Truncate to first 4000 chars (token budget)
    return text.length > 4000 ? text.slice(0, 4000) + '\n...[PDF truncated]' : text;
  } catch (err: any) {
    logger.warn(`[AxiomMultimodal] PDF parse failed for ${url}: ${err.message}`);
    // Fallback: treat as image (Gemini 1.5+ can read PDFs natively)
    return null;
  }
}

async function extractTextFromFile(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;

    const text = await response.text();
    const truncated = text.length > 4000 ? text.slice(0, 4000) + '\n...[text truncated]' : text;
    return truncated;
  } catch (err: any) {
    logger.warn(`[AxiomMultimodal] Text extract failed for ${url}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Process a single attachment → Gemini part + text context
// ---------------------------------------------------------------------------

interface ProcessedAttachment {
  part: MultimodalPart | null;
  textContext: string;  // Always populated so AI has something to reference
  skipped: boolean;
}

async function processAttachment(attachment: Attachment): Promise<ProcessedAttachment> {
  const { type, url, name, mimeType } = attachment;

  // Links — include as text context
  if (type === 'link') {
    return {
      part: null,
      textContext: `Link: "${name}" → ${url}`,
      skipped: false,
    };
  }

  // Files — determine handler
  const mappedMime = mapMimeType(mimeType);
  if (!mappedMime) {
    return {
      part: null,
      textContext: `Unsupported attachment: "${name}" (${mimeType || 'unknown type'})`,
      skipped: true,
    };
  }

  // Images → base64 inline
  if (mappedMime.startsWith('image/')) {
    const result = await fetchFileAsBase64(url);
    if (!result) {
      return {
        part: null,
        textContext: `Image (unavailable): "${name}"`,
        skipped: true,
      };
    }
    return {
      part: {
        inlineData: {
          mimeType: result.mimeType,
          data: result.base64,
        },
      },
      textContext: `Image: "${name}" (see attached)`,
      skipped: false,
    };
  }

  // PDFs → try text extraction first, fallback to inline
  if (mappedMime === 'application/pdf') {
    const pdfText = await extractTextFromPdf(url);
    if (pdfText) {
      return {
        part: null,
        textContext: `PDF "${name}":\n${pdfText}`,
        skipped: false,
      };
    }
    // Fallback: send as inline file
    const result = await fetchFileAsBase64(url);
    if (result) {
      return {
        part: {
          inlineData: {
            mimeType: result.mimeType,
            data: result.base64,
          },
        },
        textContext: `PDF: "${name}" (see attached)`,
        skipped: false,
      };
    }
    return {
      part: null,
      textContext: `PDF (unavailable): "${name}"`,
      skipped: true,
    };
  }

  // Text files → extract and include as text
  if (mappedMime === 'text/plain' || mappedMime === 'application/json') {
    const text = await extractTextFromFile(url);
    if (!text) {
      return {
        part: null,
        textContext: `Text file (unavailable): "${name}"`,
        skipped: true,
      };
    }
    return {
      part: null,
      textContext: `File "${name}":\n${text}`,
      skipped: false,
    };
  }

  return {
    part: null,
    textContext: `Unsupported: "${name}" (${mappedMime})`,
    skipped: true,
  };
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

const MAX_FILES_TOTAL = 20;
const MAX_FILES_PER_GOAL = 5;

class AxiomMultimodalService {
  /**
   * Process all attachments from notebook entries
   * Returns: { parts: Gemini parts[], textContexts: string[], totalProcessed: number, totalSkipped: number }
   */
  async processAttachments(attachments: Attachment[]): Promise<{
    parts: MultimodalPart[];
    textContexts: string[];
    totalProcessed: number;
    totalSkipped: number;
  }> {
    const capped = attachments.slice(0, MAX_FILES_TOTAL);
    const parts: MultimodalPart[] = [];
    const textContexts: string[] = [];
    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const attachment of capped) {
      const processed = await processAttachment(attachment);

      if (processed.part) {
        parts.push(processed.part);
      }
      if (processed.textContext) {
        textContexts.push(processed.textContext);
      }
      if (processed.skipped) {
        totalSkipped++;
      } else {
        totalProcessed++;
      }
    }

    logger.info(`[AxiomMultimodal] Processed ${totalProcessed}/${attachments.length}, skipped ${totalSkipped}`);

    return { parts, textContexts, totalProcessed, totalSkipped };
  }

  /**
   * Collect attachments from notebook entries, grouped by goal
   * Returns attachments per goal (capped)
   */
  collectAttachmentsFromEntries(entries: any[]): Map<string, Attachment[]> {
    const byGoal = new Map<string, Attachment[]>();

    for (const entry of entries) {
      const goalId = entry.goal_id || 'unassigned';
      const attachments: Attachment[] = Array.isArray(entry.attachments) ? entry.attachments : [];

      if (attachments.length === 0) continue;

      const existing = byGoal.get(goalId) || [];
      const merged = [...existing, ...attachments].slice(0, MAX_FILES_PER_GOAL);
      byGoal.set(goalId, merged);
    }

    return byGoal;
  }

  /**
   * Build attachment summary for AI prompt text section
   */
  buildAttachmentSummary(textContexts: string[]): string {
    if (textContexts.length === 0) return '(No attachments)';

    return textContexts
      .map((ctx, i) => `[${i + 1}] ${ctx}`)
      .join('\n\n');
  }
}

export const axiomMultimodalService = new AxiomMultimodalService();
export default axiomMultimodalService;
