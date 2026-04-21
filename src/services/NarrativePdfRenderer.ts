/**
 * NarrativePdfRenderer
 * Renders an LLM-authored narrative (Axiom diary, Self-Authoring workbook, etc.)
 * as a styled PDF. Parses a small markdown subset for chapter/section/quote/list.
 */

import PDFDocument from 'pdfkit';
import type { Response } from 'express';

// Praxis palette: gold primary, violet secondary, warm ink.
const COLORS: Record<string, string> = {
  ink:       '#111827',
  muted:     '#6B7280',
  gold:      '#F59E0B',
  goldDark:  '#D97706',
  violet:    '#8B5CF6',
  violetDark:'#6D28D9',
  line:      '#E5E7EB',
};

export interface NarrativePdfInput {
  title: string;
  subtitle?: string;
  author: string;
  tierLabel: string;
  accentColor?: string;
  dateRangeText?: string;
  body: string;
  /** Generation metadata rendered on the cover. */
  generatedAt?: Date;
  timezone?: string;
  place?: string;
  locale?: string;
  /** PNG buffer for user-id QR code. */
  qrBuffer?: Buffer;
}

function drawInlineParagraph(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  opts: { fontSize?: number; color?: string; indent?: number; align?: 'left' | 'justify' } = {},
): void {
  const size = opts.fontSize ?? 11;
  const color = opts.color ?? COLORS.ink;
  const indent = opts.indent ?? 0;
  const { left, right } = doc.page.margins;
  const width = doc.page.width - left - right - indent;

  doc.font('Times-Roman').fontSize(size).fillColor(color);

  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);

  let x = left + indent;
  const y = doc.y;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let font = 'Times-Roman';
    let content = seg;
    if (seg.startsWith('**') && seg.endsWith('**')) {
      font = 'Times-Bold';
      content = seg.slice(2, -2);
    } else if ((seg.startsWith('*') && seg.endsWith('*')) || (seg.startsWith('_') && seg.endsWith('_'))) {
      font = 'Times-Italic';
      content = seg.slice(1, -1);
    }
    const isLast = i === segments.length - 1;
    doc.font(font).fontSize(size).fillColor(color);
    doc.text(content, x, y, {
      width,
      align: opts.align ?? 'justify',
      lineGap: 2,
      continued: !isLast,
    });
    x = doc.x;
  }
  doc.moveDown(0.4);
}

function drawChapterTitle(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  accent: string,
): void {
  doc.addPage();
  doc.moveDown(4);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(accent)
    .text('CHAPTER', { align: 'left', characterSpacing: 4 });
  doc.moveDown(0.3);
  doc.font('Times-Bold').fontSize(28).fillColor(COLORS.ink).text(text);
  doc.strokeColor(accent).lineWidth(2)
    .moveTo(doc.page.margins.left, doc.y + 6)
    .lineTo(doc.page.margins.left + 80, doc.y + 6).stroke();
  doc.moveDown(1.5);
}

function drawSectionHeading(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  accent: string,
): void {
  if (doc.y + 60 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(accent).text(text);
  doc.moveDown(0.4);
  doc.fillColor(COLORS.ink);
}

function drawSubHeading(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
): void {
  if (doc.y + 40 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.muted).text(text.toUpperCase(), { characterSpacing: 1.5 });
  doc.moveDown(0.2);
  doc.fillColor(COLORS.ink);
}

function drawPullQuote(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  accent: string,
): void {
  const { left, right } = doc.page.margins;
  const width = doc.page.width - left - right - 24;
  doc.moveDown(0.4);
  const startY = doc.y;
  doc.font('Times-Italic').fontSize(12).fillColor(COLORS.muted);
  doc.text(text, left + 18, startY, { width, lineGap: 2 });
  const endY = doc.y;
  doc.strokeColor(accent).lineWidth(2).moveTo(left + 4, startY).lineTo(left + 4, endY - 2).stroke();
  doc.moveDown(0.5);
  doc.fillColor(COLORS.ink);
}

function drawListItem(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  accent: string,
): void {
  const { left } = doc.page.margins;
  const y = doc.y;
  doc.font('Times-Bold').fontSize(11).fillColor(accent).text('•', left + 4, y + 2, { lineBreak: false });
  drawInlineParagraph(doc, text, { fontSize: 11, indent: 16, align: 'left' });
}

export function renderNarrativePdf(input: NarrativePdfInput, res: Response): void {
  const accent = input.accentColor || COLORS.gold;
  const doc = new PDFDocument({
    size: 'A4',
    margin: 60,
    info: {
      Title: input.title,
      Author: input.author,
      Creator: 'Praxis',
      Subject: input.tierLabel,
    },
  });
  doc.pipe(res);

  const { width, height } = doc.page;

  // Cover band: violet→accent gradient to keep brand continuity with raw notebook.
  const bandH = 220;
  const grad = doc.linearGradient(0, 0, width, 0);
  grad.stop(0, COLORS.violet).stop(1, accent);
  doc.rect(0, 0, width, bandH).fill(grad);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
    .text('PRAXIS', 60, 60, { characterSpacing: 4 });
  doc.font('Helvetica').fontSize(10).fillColor('#FFFFFF')
    .text(input.tierLabel.toUpperCase(), 60, 80, { characterSpacing: 2 });

  // QR code top-right (encodes author's user id).
  const qrSize = 84;
  if (input.qrBuffer) {
    try {
      doc.image(input.qrBuffer, width - 60 - qrSize, 60, { width: qrSize, height: qrSize });
    } catch {
      // QR embedding is best-effort — skip silently if buffer is invalid.
    }
  }

  doc.fillColor(COLORS.ink).font('Times-Bold').fontSize(40)
    .text(input.title, 60, 260, { width: width - 120 });
  if (input.subtitle) {
    doc.font('Times-Italic').fontSize(16).fillColor(COLORS.muted)
      .text(input.subtitle, 60, doc.y + 10, { width: width - 120 });
  }

  // Intestation: date / time / place, plus author line and range.
  const locale = input.locale || 'en-US';
  const tz = input.timezone || 'UTC';
  const generatedAt = input.generatedAt || new Date();
  const dateStr = generatedAt.toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz,
  });
  const timeStr = generatedAt.toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: tz,
  });

  doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted)
    .text(`Authored by ${input.author}`, 60, height - 200);
  if (input.dateRangeText) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted)
      .text(input.dateRangeText, 60, doc.y + 4);
  }
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
    .text('GENERATED', 60, height - 150, { characterSpacing: 1.2 });
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink)
    .text(`${dateStr} · ${timeStr}`);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
    .text('PLACE', 60, doc.y + 8, { characterSpacing: 1.2 });
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink)
    .text(input.place || tz);

  const lines = input.body.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (!line.trim()) { doc.moveDown(0.3); continue; }

    if (line.startsWith('### ')) { drawSubHeading(doc, line.slice(4).trim()); continue; }
    if (line.startsWith('## '))  { drawSectionHeading(doc, line.slice(3).trim(), accent); continue; }
    if (line.startsWith('# '))   { drawChapterTitle(doc, line.slice(2).trim(), accent); continue; }
    if (line.startsWith('> '))   { drawPullQuote(doc, line.slice(2).trim(), accent); continue; }
    if (/^---+$/.test(line.trim())) {
      const { left, right } = doc.page.margins;
      doc.strokeColor(COLORS.line).lineWidth(0.6)
        .moveTo(left + 120, doc.y + 4)
        .lineTo(doc.page.width - right - 120, doc.y + 4).stroke();
      doc.moveDown(0.6);
      continue;
    }
    const listMatch = /^[-*]\s+(.*)$/.exec(line.trim());
    if (listMatch) { drawListItem(doc, listMatch[1], accent); continue; }

    drawInlineParagraph(doc, line.trim(), { fontSize: 11 });
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - doc.page.margins.bottom + 24;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text(`${input.tierLabel} · ${input.author}`, doc.page.margins.left, bottom, { lineBreak: false });
    if (i > range.start) {
      doc.text(`${i - range.start + 1}`,
        doc.page.width - doc.page.margins.right - 40, bottom, { width: 40, align: 'right', lineBreak: false });
    }
  }

  doc.end();
}
