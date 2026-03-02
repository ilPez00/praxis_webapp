/**
 * KnowledgeBaseService
 *
 * Parses the PDF books in /sources at first use and caches the extracted text.
 * The extracted excerpts are injected into Master Roshi's system prompt so he
 * can draw on the wisdom of Zero to One, Antifragile, Atomic Habits and BAM.
 */

import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

// pdf-parse is a CommonJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

interface BookExcerpt {
  title: string;
  text: string;
}

const BOOKS = [
  { file: '0to1.pdf',      title: 'Zero to One — Peter Thiel' },
  { file: 'antifragile.pdf', title: 'Antifragile — Nassim Nicholas Taleb' },
  { file: 'atomichabits',  title: 'Atomic Habits — James Clear' },
  { file: 'BAM',           title: 'BAM' },
];

// Characters to keep per book — enough to cover intro + first two chapters
const CHARS_PER_BOOK = 7000;
// Only parse the first N pages (speeds up startup)
const MAX_PAGES = 35;

class KnowledgeBaseService {
  private excerpts: BookExcerpt[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._parse();
    await this.loadPromise;
    this.loaded = true;
  }

  private async _parse(): Promise<void> {
    const sourcesDir = path.resolve(process.cwd(), 'sources');

    if (!fs.existsSync(sourcesDir)) {
      logger.warn('[KnowledgeBase] sources/ directory not found — AI coach will have no book knowledge');
      return;
    }

    for (const { file, title } of BOOKS) {
      const filePath = path.join(sourcesDir, file);
      if (!fs.existsSync(filePath)) {
        logger.warn(`[KnowledgeBase] ${file} not found — skipping`);
        continue;
      }
      try {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer, { max: MAX_PAGES });
        const text = (data.text as string)
          .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines
          .trim()
          .slice(0, CHARS_PER_BOOK);
        this.excerpts.push({ title, text });
        logger.info(`[KnowledgeBase] Loaded "${title}" (${text.length} chars)`);
      } catch (err: any) {
        logger.warn(`[KnowledgeBase] Failed to parse ${file}: ${err.message}`);
      }
    }

    logger.info(`[KnowledgeBase] Ready — ${this.excerpts.length}/${BOOKS.length} books loaded`);
  }

  /** Returns a formatted knowledge block for injection into AI prompts */
  getContext(): string {
    if (this.excerpts.length === 0) return '';
    const sections = this.excerpts
      .map(b => `### ${b.title}\n${b.text}`)
      .join('\n\n---\n\n');
    return `## Master Roshi's Library — Core Texts\n${sections}`;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export const knowledgeBase = new KnowledgeBaseService();
