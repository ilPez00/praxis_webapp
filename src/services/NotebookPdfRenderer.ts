/**
 * NotebookPdfRenderer
 * Streams a curated PDF notebook export using pdfkit:
 * cover page, metrics summary, per-category tracker tables,
 * goals hierarchy, and life-log timeline.
 */

import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { StructuredSummary } from './StructuredTrackerReader';

export interface NotebookPdfInput {
  userName: string;
  since: Date;
  until: Date;
  isPro: boolean;
  balance: number;
  goals: Array<{ id: string; name: string; domain?: string; progress?: number; parentId?: string | null; customDetails?: string }>;
  timeline: Array<{ date: string; kind: string; text: string }>;
  structured: StructuredSummary | null;
  legacyTrackerLogs: Array<{ type: string; logged_at: string; data: any }>;
  checkinCount: number;
  achievementCount: number;
}

const COLORS = {
  ink: '#111827',
  muted: '#6B7280',
  accent: '#A78BFA',
  accent2: '#8B5CF6',
  gold: '#F59E0B',
  line: '#E5E7EB',
  lineSoft: '#F3F4F6',
  zebra: '#F9FAFB',
};

const fmtDate = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};

const dateOnly = (iso: any): string => (typeof iso === 'string' ? iso.slice(0, 10) : '');

/**
 * Draw a table with a header row and zebra-striped body. Wraps cells and auto-paginates.
 */
function drawTable(
  doc: InstanceType<typeof PDFDocument>,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  colWidths: number[],
): void {
  const rowPadding = 5;
  const headerHeight = 22;
  const { left, right } = doc.page.margins;
  const startX = left;
  const usableW = doc.page.width - left - right;
  // normalize colWidths to sum to usableW
  const sumW = colWidths.reduce((a, b) => a + b, 0) || 1;
  const widths = colWidths.map(w => (w / sumW) * usableW);

  const measureRow = (cells: Array<string | number | null | undefined>): number => {
    let max = 14;
    for (let i = 0; i < cells.length; i++) {
      const h = doc.heightOfString(String(cells[i] ?? ''), {
        width: widths[i] - rowPadding * 2,
      });
      if (h > max) max = h;
    }
    return max + rowPadding * 2;
  };

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(startX, y, usableW, headerHeight).fill(COLORS.accent);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + rowPadding, y + 6, {
        width: widths[i] - rowPadding * 2,
        lineBreak: false,
        ellipsis: true,
      });
      x += widths[i];
    }
    doc.y = y + headerHeight;
    doc.fillColor(COLORS.ink);
  };

  drawHeader();
  doc.font('Helvetica').fontSize(9);

  let zebra = false;
  for (const row of rows) {
    const h = measureRow(row);
    // new page if overflow
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
      doc.font('Helvetica').fontSize(9);
      zebra = false;
    }
    const y = doc.y;
    if (zebra) doc.rect(startX, y, usableW, h).fill(COLORS.zebra);
    doc.fillColor(COLORS.ink);
    let x = startX;
    for (let i = 0; i < row.length; i++) {
      doc.text(String(row[i] ?? ''), x + rowPadding, y + rowPadding, {
        width: widths[i] - rowPadding * 2,
      });
      x += widths[i];
    }
    // row separator
    doc.strokeColor(COLORS.line).lineWidth(0.3).moveTo(startX, y + h).lineTo(startX + usableW, y + h).stroke();
    doc.y = y + h;
    zebra = !zebra;
  }
  doc.moveDown(0.6);
}

function sectionTitle(doc: InstanceType<typeof PDFDocument>, text: string, color = COLORS.ink): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 80) doc.addPage();
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(16).fillColor(color).text(text);
  doc.strokeColor(COLORS.accent2).lineWidth(1.2)
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.margins.left + 64, doc.y + 2).stroke();
  doc.moveDown(0.8);
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10);
}

function kv(doc: InstanceType<typeof PDFDocument>, label: string, value: string): void {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text(label, { continued: true });
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink).text(`  ${value}`);
}

function drawMetricTile(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number,
  label: string, value: string, accent = COLORS.accent,
): void {
  doc.roundedRect(x, y, w, h, 6).fillOpacity(0.08).fill(accent).fillOpacity(1);
  doc.roundedRect(x, y, w, h, 6).strokeColor(accent).lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fontSize(14).fillColor(accent).text(value, x + 8, y + 7, { width: w - 16 });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(label, x + 8, y + 26, { width: w - 16 });
  doc.fillColor(COLORS.ink);
}

function drawMetricsGrid(
  doc: InstanceType<typeof PDFDocument>,
  tiles: Array<{ label: string; value: string; accent?: string }>,
): void {
  if (tiles.length === 0) return;
  const { left, right } = doc.page.margins;
  const usableW = doc.page.width - left - right;
  const cols = 4;
  const gap = 8;
  const tileW = (usableW - gap * (cols - 1)) / cols;
  const tileH = 44;
  let row = 0, col = 0;
  let yStart = doc.y;
  for (const t of tiles) {
    const x = left + col * (tileW + gap);
    const y = yStart + row * (tileH + gap);
    drawMetricTile(doc, x, y, tileW, tileH, t.label, t.value, t.accent);
    col++;
    if (col >= cols) { col = 0; row++; }
  }
  const rows = Math.ceil(tiles.length / cols);
  doc.y = yStart + rows * (tileH + gap) + 4;
}

function renderStructuredSection(doc: InstanceType<typeof PDFDocument>, s: StructuredSummary): void {
  const r = s.recent || {};

  if (s.lifts && r.lifts?.length) {
    sectionTitle(doc, `Lifts — ${s.lifts.row_count} sets, ${s.lifts.total_volume_kg} kg total volume`);
    drawTable(
      doc,
      ['Date', 'Exercise', 'Sets', 'Reps', 'Weight kg', 'Volume kg', 'Notes'],
      r.lifts.map((x: any) => [dateOnly(x.logged_at), x.exercise, x.sets, x.reps, x.weight_kg, x.volume_kg, x.notes]),
      [2, 3, 1, 1, 1.2, 1.4, 3],
    );
    if (s.lifts.top_exercises?.length) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text('Top exercises by volume:');
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
      for (const ex of s.lifts.top_exercises) {
        doc.text(`• ${ex.exercise} — ${ex.volume_kg} kg across ${ex.sets} sets`);
      }
      doc.moveDown(0.4);
    }
  }

  if (s.meals && r.meals?.length) {
    sectionTitle(doc, `Meals — ${s.meals.total_kcal} kcal · P ${s.meals.total_protein_g}g / C ${s.meals.total_carbs_g}g / F ${s.meals.total_fat_g}g`);
    drawTable(
      doc,
      ['Date', 'Slot', 'Food', 'g', 'kcal', 'P', 'C', 'F', 'Notes'],
      r.meals.map((x: any) => [dateOnly(x.logged_at), x.meal_slot, x.food, x.grams, x.calories, x.protein_g, x.carbs_g, x.fat_g, x.notes]),
      [2, 1.5, 3, 1, 1.2, 1, 1, 1, 3],
    );
  }

  if (s.cardio && r.cardio?.length) {
    sectionTitle(doc, `Cardio — ${s.cardio.total_duration_min} min · ${s.cardio.total_distance_km} km · avg pace ${s.cardio.avg_pace_min_per_km ?? '—'} min/km`);
    drawTable(
      doc,
      ['Date', 'Activity', 'Min', 'km', 'Pace', 'Notes'],
      r.cardio.map((x: any) => [dateOnly(x.logged_at), x.activity, x.duration_min, x.distance_km, x.pace_min_per_km, x.notes]),
      [2, 2.5, 1.2, 1.2, 1.4, 3],
    );
  }

  if (s.steps && r.steps?.length) {
    sectionTitle(doc, `Steps — total ${s.steps.total_steps.toLocaleString()}, avg ${s.steps.avg_steps_per_day}/day, goal hit ${s.steps.goal_hit_days} days`);
    drawTable(
      doc,
      ['Date', 'Steps', 'Goal', 'Source'],
      r.steps.map((x: any) => [dateOnly(x.logged_at), x.steps, x.daily_goal, x.source]),
      [2, 2, 2, 2],
    );
  }

  if (s.sleep && r.sleep?.length) {
    const hist = Object.entries(s.sleep.quality_histogram || {}).map(([k, v]) => `${k}: ${v}`).join('  ');
    sectionTitle(doc, `Sleep — avg ${s.sleep.avg_duration_h}h over ${s.sleep.night_count} nights${hist ? ` · ${hist}` : ''}`);
    drawTable(
      doc,
      ['Date', 'Hours', 'Quality', 'Notes'],
      r.sleep.map((x: any) => [dateOnly(x.logged_at), x.duration_h, x.quality, x.notes]),
      [2, 1.5, 2, 4],
    );
  }

  if (s.meditation && r.meditation?.length) {
    sectionTitle(doc, `Meditation — ${s.meditation.total_duration_min} min`);
    drawTable(
      doc,
      ['Date', 'Min', 'Type', 'Feeling', 'Notes'],
      r.meditation.map((x: any) => [dateOnly(x.logged_at), x.duration_min, x.type, x.feeling, x.notes]),
      [2, 1.2, 2, 2, 3],
    );
  }

  if (s.study && r.study?.length) {
    sectionTitle(doc, `Study — ${s.study.total_duration_min} min`);
    drawTable(
      doc,
      ['Date', 'Subject', 'Min', 'Topic', 'Notes'],
      r.study.map((x: any) => [dateOnly(x.logged_at), x.subject, x.duration_min, x.topic, x.notes]),
      [2, 2, 1.2, 2, 3],
    );
    const bs = Object.entries(s.study.by_subject || {}).map(([k, v]) => `${k}: ${v} min`).join('  ·  ');
    if (bs) { doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`By subject: ${bs}`); doc.moveDown(0.4); }
  }

  if (s.books && r.books?.length) {
    sectionTitle(doc, `Reading — ${s.books.total_pages_read} pages`);
    drawTable(
      doc,
      ['Date', 'Title', 'Author', 'Pages', 'Total', 'Rating', 'Notes'],
      r.books.map((x: any) => [dateOnly(x.logged_at), x.title, x.author, x.pages_read, x.total_pages, x.rating, x.notes]),
      [2, 3, 2, 1, 1, 1, 2],
    );
  }

  if (s.expenses && r.expenses?.length) {
    sectionTitle(doc, `Expenses — −€${s.expenses.total_expense_eur} / +€${s.expenses.total_income_eur}`);
    drawTable(
      doc,
      ['Date', 'Type', 'Category', 'Merchant', 'Amount €', 'Notes'],
      r.expenses.map((x: any) => [dateOnly(x.logged_at), x.tx_type, x.category, x.merchant, x.amount_eur, x.notes]),
      [2, 1.2, 2, 2, 1.4, 3],
    );
  }

  if (s.investments && r.investments?.length) {
    sectionTitle(doc, `Investments — €${s.investments.total_invested_eur} deployed`);
    drawTable(
      doc,
      ['Date', 'Action', 'Asset', 'Qty', 'Price €', 'Total €', 'Notes'],
      r.investments.map((x: any) => [dateOnly(x.logged_at), x.action, x.asset, x.quantity, x.price_eur, x.total_eur, x.notes]),
      [2, 1.2, 2, 1.2, 1.4, 1.4, 3],
    );
  }

  if (s.music && r.music?.length) {
    sectionTitle(doc, `Music — ${s.music.total_duration_min} min`);
    drawTable(
      doc,
      ['Date', 'Instrument', 'Piece', 'Min', 'Focus', 'Notes'],
      r.music.map((x: any) => [dateOnly(x.logged_at), x.instrument, x.piece, x.duration_min, x.focus, x.notes]),
      [2, 2, 2.5, 1.2, 2, 3],
    );
  }

  if (s.journal && r.journal?.length) {
    sectionTitle(doc, `Journal — ${s.journal.row_count} entries`);
    drawTable(
      doc,
      ['Date', 'Mood', 'Entry', 'Gratitude'],
      r.journal.map((x: any) => [dateOnly(x.logged_at), x.mood, (x.entry || '').slice(0, 200), x.gratitude]),
      [2, 1.5, 5, 3],
    );
  }

  if (s.gaming && r.gaming?.length) {
    sectionTitle(doc, `Gaming — ${s.gaming.total_duration_min} min`);
    drawTable(
      doc,
      ['Date', 'Game', 'Min', 'Platform', 'Mode', 'Notes'],
      r.gaming.map((x: any) => [dateOnly(x.logged_at), x.game, x.duration_min, x.platform, x.mode, x.notes]),
      [2, 2.5, 1.2, 2, 1.8, 3],
    );
  }
}

export function renderNotebookPdf(input: NotebookPdfInput, res: Response): void {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `Praxis Notebook — ${input.userName}`,
      Author: input.userName,
      Creator: 'Praxis',
    },
  });
  doc.pipe(res);

  // ─── Cover ───────────────────────────────────────────────────────────
  doc.fillColor(COLORS.accent2).font('Helvetica-Bold').fontSize(10).text('PRAXIS NOTEBOOK', { align: 'left' });
  doc.moveDown(3);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(34).text(input.userName);
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.muted)
    .text(`${fmtDate(input.since)} — ${fmtDate(input.until)}`);
  doc.moveDown(0.8);
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
    .text(input.isPro ? 'Pro Member' : `Balance: ${input.balance} PP`);
  doc.moveDown(2);

  const metricTiles: Array<{ label: string; value: string; accent?: string }> = [
    { label: 'Goals', value: String(input.goals.length), accent: COLORS.accent },
    { label: 'Check-ins', value: String(input.checkinCount), accent: COLORS.accent },
    { label: 'Achievements', value: String(input.achievementCount), accent: COLORS.gold },
    { label: 'Life logs', value: String(input.timeline.length), accent: COLORS.accent2 },
  ];
  const s = input.structured;
  if (s?.lifts) metricTiles.push({ label: 'Lift volume', value: `${s.lifts.total_volume_kg} kg` });
  if (s?.meals) metricTiles.push({ label: 'Calories', value: `${s.meals.total_kcal} kcal` });
  if (s?.cardio) metricTiles.push({ label: 'Cardio', value: `${s.cardio.total_duration_min} min` });
  if (s?.steps) metricTiles.push({ label: 'Steps', value: s.steps.total_steps.toLocaleString() });
  if (s?.sleep) metricTiles.push({ label: 'Sleep/night', value: `${s.sleep.avg_duration_h} h` });
  if (s?.meditation) metricTiles.push({ label: 'Meditation', value: `${s.meditation.total_duration_min} min` });
  if (s?.study) metricTiles.push({ label: 'Study', value: `${s.study.total_duration_min} min` });
  if (s?.books) metricTiles.push({ label: 'Pages read', value: String(s.books.total_pages_read) });
  if (s?.expenses) metricTiles.push({ label: 'Net spend', value: `€${s.expenses.total_expense_eur - s.expenses.total_income_eur}` });
  if (s?.investments) metricTiles.push({ label: 'Invested', value: `€${s.investments.total_invested_eur}` });

  sectionTitle(doc, 'At a glance', COLORS.accent2);
  drawMetricsGrid(doc, metricTiles);

  // ─── Goals hierarchy ─────────────────────────────────────────────────
  sectionTitle(doc, 'Goals & Hierarchy', COLORS.accent2);
  if (input.goals.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted).text('No goals set.');
  } else {
    const rootGoals = input.goals.filter(g => !g.parentId);
    const childrenOf = (pid: string) => input.goals.filter(g => g.parentId === pid);
    const render = (g: any, depth: number): void => {
      const prefix = '  '.repeat(depth);
      const pct = Math.round((g.progress || 0) * 100);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink)
        .text(`${prefix}• ${g.name}`, { continued: true });
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
        .text(`  [${g.domain || '—'}] ${pct}%`);
      if (g.customDetails) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor(COLORS.muted).text(`${prefix}  ${g.customDetails}`);
      }
      for (const c of childrenOf(g.id)) render(c, depth + 1);
    };
    for (const g of rootGoals) render(g, 0);
  }
  doc.moveDown(0.6);

  // ─── Structured tracker tables ───────────────────────────────────────
  if (input.structured) {
    doc.addPage();
    sectionTitle(doc, 'Tracker Data', COLORS.accent2);
    renderStructuredSection(doc, input.structured);
  }

  // ─── Legacy tracker rows (types without a structured table) ──────────
  if (input.legacyTrackerLogs.length > 0) {
    sectionTitle(doc, 'Other Tracker Logs', COLORS.accent2);
    const byType: Record<string, typeof input.legacyTrackerLogs> = {};
    for (const e of input.legacyTrackerLogs) (byType[e.type] ||= []).push(e);
    for (const [type, rows] of Object.entries(byType)) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink).text(type.toUpperCase());
      doc.moveDown(0.2);
      drawTable(
        doc,
        ['Date', 'Payload'],
        rows.map(r => [dateOnly(r.logged_at), JSON.stringify(r.data)]),
        [2, 8],
      );
    }
  }

  // ─── Life-log timeline ───────────────────────────────────────────────
  if (input.timeline.length > 0) {
    doc.addPage();
    sectionTitle(doc, 'Life Logs', COLORS.accent2);
    const sorted = [...input.timeline].sort((a, b) => b.date.localeCompare(a.date));
    let currentDay = '';
    for (const e of sorted) {
      const day = dateOnly(e.date);
      if (day !== currentDay) {
        currentDay = day;
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.accent2)
          .text(fmtDate(day));
        doc.strokeColor(COLORS.line).lineWidth(0.3)
          .moveTo(doc.page.margins.left, doc.y + 1)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y + 1).stroke();
        doc.moveDown(0.2);
      }
      const time = new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text(`${time}  `, { continued: true });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.accent).text(`[${e.kind}] `, { continued: true });
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink).text(e.text);
    }
  }

  // ─── Footer on every page ────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - doc.page.margins.bottom + 20;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text(`Praxis Notebook · ${input.userName}`, doc.page.margins.left, bottom, { lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`,
      doc.page.width - doc.page.margins.right - 80, bottom, { width: 80, align: 'right', lineBreak: false });
  }

  doc.end();
}
