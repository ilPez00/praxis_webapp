/**
 * NotebookPdfRenderer
 * Streams a curated PDF notebook export using pdfkit:
 * branded cover (date/time/place + user-id QR), metrics, per-category tracker
 * tables, goals hierarchy, and life-log timeline.
 */

import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import type { StructuredSummary } from './StructuredTrackerReader';

export interface NotebookPdfInput {
  userName: string;
  userId: string;
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
  checkinByDay?: Record<string, number>;
  /** Generation metadata for the cover intestation. */
  generatedAt: Date;
  /** IANA timezone (e.g. "Europe/Rome"). Used for local-time formatting. */
  timezone: string;
  /** Human-readable place label (usually the city/region from the IANA tz). */
  place: string;
  /** Browser locale used for date/number formatting on the cover. */
  locale: string;
  /** PNG buffer of a QR code encoding the user id. Rendered on the cover. */
  qrBuffer?: Buffer;
}

// ── Praxis palette ────────────────────────────────────────────────────────
// Mirrors the app's theme (gold primary, violet secondary) tuned for print.
const COLORS: Record<string, string> = {
  ink:       '#111827',
  mutedInk:  '#374151',
  muted:     '#6B7280',
  gold:      '#F59E0B',
  goldDark:  '#D97706',
  goldLight: '#FCD34D',
  violet:    '#8B5CF6',
  violetDark:'#6D28D9',
  violetLt:  '#A78BFA',
  line:      '#E5E7EB',
  lineSoft:  '#F3F4F6',
  zebra:     '#FAFAF9',
  paper:     '#FFFFFF',
};

// Primary = gold, Secondary = violet. Aliases so older drawing helpers stay readable.
const ACCENT = COLORS.gold;
const ACCENT2 = COLORS.violet;

const DOMAIN_PALETTE: Record<string, string> = {
  Fitness:       '#EF4444',
  Career:        '#3B82F6',
  Learning:      COLORS.violetLt,
  Academics:     COLORS.violetLt,
  Relationships: '#EC4899',
  Finance:       '#10B981',
  Creative:      COLORS.gold,
  Health:        '#14B8A6',
  Spiritual:     COLORS.violet,
  Business:      '#6366F1',
  Personal:      COLORS.violetLt,
};
const domainColor = (d?: string) => (d && DOMAIN_PALETTE[d]) || ACCENT;

const fmtDate = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
};
const dateOnly = (iso: any): string => (typeof iso === 'string' ? iso.slice(0, 10) : '');

// Format any scalar for prose rendering (legacy tracker lines).
const scalarText = (v: any): string => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'string') {
    // stripe obvious ISO timestamps down to date for compactness
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    return v;
  }
  return String(v);
};

// Pretty-print a legacy tracker payload as a single prose line.
// Falls back to `key: value` pairs when no canonical order is known.
const PREFERRED_KEYS = ['activity', 'role', 'company', 'person', 'status', 'date', 'title', 'author', 'subject', 'topic', 'amount', 'currency', 'notes', 'connections_made', 'events_attended'];
function formatLegacyPayload(data: any): string {
  if (data == null) return '';
  if (typeof data !== 'object') return scalarText(data);

  // shape: { items: [{ name, value, unit? }, ...] } → comma list
  if (Array.isArray(data.items)) {
    return data.items
      .map((it: any) => {
        if (typeof it !== 'object' || it === null) return scalarText(it);
        const name = it.name || it.label || it.title || '';
        const value = it.value != null ? scalarText(it.value) : '';
        const unit = it.unit ? String(it.unit) : '';
        if (name && value) return `${name}: ${value}${unit}`;
        return name || value || '';
      })
      .filter(Boolean)
      .join(', ');
  }

  const seen = new Set<string>();
  const parts: string[] = [];

  // Headline fragment: role/activity/title + optional "with person" + optional "@ company"
  const headlineBits: string[] = [];
  for (const k of ['role', 'activity', 'title', 'subject', 'food', 'exercise', 'game', 'piece']) {
    if (data[k] != null && data[k] !== '') { headlineBits.push(scalarText(data[k])); seen.add(k); break; }
  }
  if (data.person && !seen.has('person')) { headlineBits.push(`with ${scalarText(data.person)}`); seen.add('person'); }
  if (data.company && !seen.has('company')) { headlineBits.push(`@ ${scalarText(data.company)}`); seen.add('company'); }
  if (headlineBits.length) parts.push(headlineBits.join(' '));

  // Status flag in square brackets
  if (data.status != null && data.status !== '') { parts.push(`[${scalarText(data.status)}]`); seen.add('status'); }

  // Numeric rollups
  for (const k of ['connections_made', 'events_attended', 'pages_read', 'duration', 'distance', 'calories', 'steps', 'amount', 'quantity']) {
    if (data[k] != null && data[k] !== '' && !seen.has(k)) {
      parts.push(`${k.replace(/_/g, ' ')}: ${scalarText(data[k])}`);
      seen.add(k);
    }
  }

  // Free-text notes trail
  if (data.notes && !seen.has('notes')) { parts.push(`— ${scalarText(data.notes)}`); seen.add('notes'); }

  // Leftover scalar fields
  const leftover = Object.keys(data).filter(k => !seen.has(k) && k !== 'items');
  for (const k of leftover) {
    const v = data[k];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue; // skip nested objects/arrays in fallback
    parts.push(`${k}: ${scalarText(v)}`);
  }

  return parts.filter(Boolean).join(' · ');
}

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
    doc.rect(startX, y, usableW, headerHeight).fill(ACCENT);
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
  doc.strokeColor(ACCENT2).lineWidth(1.2)
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.margins.left + 64, doc.y + 2).stroke();
  doc.moveDown(0.8);
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10);
}

function drawProgressBar(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number,
  pct: number, accent = ACCENT, label?: string, rightLabel?: string,
): void {
  const clamped = Math.max(0, Math.min(100, pct));
  doc.roundedRect(x, y, w, h, h / 2).fillOpacity(0.12).fill(accent).fillOpacity(1);
  if (clamped > 0) {
    doc.roundedRect(x, y, Math.max(h, (w * clamped) / 100), h, h / 2).fill(accent);
  }
  if (label) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
      .text(label, x + 8, y + (h - 9) / 2, { width: w - 80, lineBreak: false, ellipsis: true });
  }
  if (rightLabel) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink)
      .text(rightLabel, x + w - 44, y + (h - 9) / 2, { width: 40, align: 'right', lineBreak: false });
  }
  doc.fillColor(COLORS.ink);
}

function drawBarChart(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  series: Array<{ label: string; value: number }>,
  accent = ACCENT,
  chartHeight = 110,
): void {
  if (series.length === 0) return;
  if (doc.y + chartHeight + 30 > doc.page.height - doc.page.margins.bottom) doc.addPage();

  const { left, right } = doc.page.margins;
  const usableW = doc.page.width - left - right;
  const x0 = left;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text(title);
  const startY = doc.y + 4;

  const maxVal = Math.max(1, ...series.map(s => s.value));
  const gap = 3;
  const barW = Math.max(6, (usableW - gap * (series.length - 1)) / series.length);

  for (let i = 0; i < series.length; i++) {
    const v = Math.max(0, series[i].value);
    const h = (v / maxVal) * chartHeight;
    const x = x0 + i * (barW + gap);
    const y = startY + chartHeight - h;
    doc.rect(x, y, barW, h).fillOpacity(v > 0 ? 0.85 : 0.15).fill(accent).fillOpacity(1);
    if (v > 0 && h > 16 && barW > 18) {
      doc.font('Helvetica').fontSize(7).fillColor('#FFFFFF')
        .text(String(Math.round(v)), x, y + 3, { width: barW, align: 'center', lineBreak: false });
    }
  }
  doc.strokeColor(COLORS.line).lineWidth(0.5).moveTo(x0, startY + chartHeight).lineTo(x0 + usableW, startY + chartHeight).stroke();

  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted);
  const showEvery = series.length > 14 ? Math.ceil(series.length / 14) : 1;
  for (let i = 0; i < series.length; i++) {
    if (i % showEvery !== 0) continue;
    const x = x0 + i * (barW + gap);
    doc.text(series[i].label, x, startY + chartHeight + 3, { width: barW, align: 'center', lineBreak: false, ellipsis: true });
  }
  doc.y = startY + chartHeight + 18;
  doc.fillColor(COLORS.ink);
}

function drawHeatmap(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  counts: Record<string, number>,
  since: Date, until: Date,
  accent = ACCENT,
): void {
  const msPerDay = 86400000;
  const startIso = since.toISOString().slice(0, 10);
  const start = new Date(startIso);
  const end = new Date(until.toISOString().slice(0, 10));
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  if (days > 400) return;

  const startDow = (start.getDay() + 6) % 7;
  const gridStart = new Date(start.getTime() - startDow * msPerDay);
  const weeks = Math.ceil((days + startDow) / 7);

  const { left, right } = doc.page.margins;
  const usableW = doc.page.width - left - right;
  const cell = Math.min(10, Math.floor(usableW / (weeks + 1)) - 1);
  const gap = 2;
  const chartH = 7 * (cell + gap) + 20;
  if (doc.y + chartH > doc.page.height - doc.page.margins.bottom) doc.addPage();

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.muted).text(title);
  const y0 = doc.y + 4;

  const maxCount = Math.max(1, ...Object.values(counts));
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart.getTime() + (w * 7 + d) * msPerDay);
      if (day < start || day > end) continue;
      const iso = day.toISOString().slice(0, 10);
      const c = counts[iso] || 0;
      const intensity = c === 0 ? 0.08 : 0.25 + 0.75 * (c / maxCount);
      const x = left + w * (cell + gap);
      const y = y0 + d * (cell + gap);
      doc.rect(x, y, cell, cell).fillOpacity(intensity).fill(accent).fillOpacity(1);
    }
  }
  doc.y = y0 + 7 * (cell + gap) + 4;
  doc.fillColor(COLORS.ink);
}

function drawMetricTile(
  doc: InstanceType<typeof PDFDocument>,
  x: number, y: number, w: number, h: number,
  label: string, value: string, accent = ACCENT,
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
  const yStart = doc.y;
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

// Render legacy tracker rows as grouped natural-language entries.
// Each row becomes `Mon Day · <prose>` instead of a raw JSON table cell.
function renderLegacyLogs(
  doc: InstanceType<typeof PDFDocument>,
  legacy: Array<{ type: string; logged_at: string; data: any }>,
): void {
  if (legacy.length === 0) return;
  sectionTitle(doc, 'Other Tracker Notes', COLORS.violet);

  const byType: Record<string, typeof legacy> = {};
  for (const e of legacy) (byType[e.type] ||= []).push(e);

  const { left, right } = doc.page.margins;
  const usableW = doc.page.width - left - right;

  for (const [type, rows] of Object.entries(byType)) {
    const prettyType = type.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (doc.y + 40 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.goldDark).text(prettyType);
    doc.strokeColor(COLORS.line).lineWidth(0.4)
      .moveTo(left, doc.y + 1).lineTo(left + usableW, doc.y + 1).stroke();
    doc.moveDown(0.25);

    for (const row of [...rows].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
      const prose = formatLegacyPayload(row.data) || '—';
      const dateLabel = fmtDate(row.logged_at);
      if (doc.y + 24 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted)
        .text(dateLabel, left, doc.y, { width: 70, continued: true });
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink)
        .text(`  ${prose}`, { width: usableW - 70 });
      doc.moveDown(0.15);
    }
    doc.moveDown(0.4);
  }
}

// Branded cover page: gold band + meta block + QR code of the user id.
function drawCover(doc: InstanceType<typeof PDFDocument>, input: NotebookPdfInput): void {
  const { width } = doc.page;
  const { left } = doc.page.margins;

  // Top band: violet→gold gradient for brand recognition.
  const bandH = 96;
  const grad = doc.linearGradient(0, 0, width, 0);
  grad.stop(0, COLORS.violet).stop(1, COLORS.gold);
  doc.rect(0, 0, width, bandH).fill(grad);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11)
    .text('PRAXIS', left, 28, { characterSpacing: 6, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor('#FFFFFF')
    .text('NOTEBOOK · RAW EXPORT', left, 48, { characterSpacing: 3, lineBreak: false });

  // QR top-right over the band.
  const qrSize = 78;
  if (input.qrBuffer) {
    try {
      doc.image(input.qrBuffer, width - left - qrSize, 10, { width: qrSize, height: qrSize });
    } catch {
      // If the QR buffer is invalid, silently skip — the rest of the cover still renders.
    }
  }

  // Author + date-range below the band.
  const afterBandY = bandH + 36;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(32)
    .text(input.userName, left, afterBandY);
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.muted)
    .text(`${fmtDate(input.since)} — ${fmtDate(input.until)}`);
  doc.moveDown(0.5);
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
    .text(input.isPro ? 'Pro Member' : `Balance: ${input.balance} PP`);

  // Intestation: date, time, place.
  const locale = input.locale || 'en-US';
  const tz = input.timezone || 'UTC';
  const dateStr = input.generatedAt.toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz,
  });
  const timeStr = input.generatedAt.toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: tz,
  });

  doc.moveDown(1.4);
  const metaY = doc.y;
  const metaLabel = (label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted)
      .text(label.toUpperCase(), { characterSpacing: 1.2 });
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.ink).text(value);
    doc.moveDown(0.3);
  };
  metaLabel('Date', dateStr);
  metaLabel('Time', timeStr);
  metaLabel('Place', input.place || tz);
  // Low-contrast hint under the QR in case the reader wonders.
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted)
    .text('QR code encodes the author\'s Praxis user id', { align: 'left' });

  doc.y = Math.max(doc.y, metaY + qrSize + 10);
  doc.moveDown(1.2);
}

export function renderNotebookPdf(input: NotebookPdfInput, res: Response): void {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `Praxis Notebook — ${input.userName}`,
      Author: input.userName,
      Creator: 'Praxis',
      Keywords: `praxis,notebook,${input.userId}`,
    },
  });
  doc.pipe(res);

  // ─── Cover ───────────────────────────────────────────────────────────
  drawCover(doc, input);

  const metricTiles: Array<{ label: string; value: string; accent?: string }> = [
    { label: 'Goals', value: String(input.goals.length), accent: ACCENT },
    { label: 'Check-ins', value: String(input.checkinCount), accent: ACCENT },
    { label: 'Achievements', value: String(input.achievementCount), accent: COLORS.goldLight },
    { label: 'Life logs', value: String(input.timeline.length), accent: ACCENT2 },
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

  sectionTitle(doc, 'At a glance', ACCENT2);
  drawMetricsGrid(doc, metricTiles);

  if (input.checkinByDay && Object.keys(input.checkinByDay).length > 0) {
    sectionTitle(doc, 'Consistency', ACCENT2);
    drawHeatmap(doc, 'Check-in streak', input.checkinByDay, input.since, input.until, ACCENT);
  }

  // ─── Goals hierarchy with progress bars ──────────────────────────────
  sectionTitle(doc, 'Goals & Progress', ACCENT2);
  if (input.goals.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted).text('No goals set.');
  } else {
    const rootGoals = input.goals.filter(g => !g.parentId);
    const childrenOf = (pid: string) => input.goals.filter(g => g.parentId === pid);
    const { left } = doc.page.margins;
    const { right } = doc.page.margins;
    const usableW = doc.page.width - left - right;
    const render = (g: any, depth: number): void => {
      if (doc.y + 22 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const pct = Math.round((g.progress || 0) * 100);
      const color = domainColor(g.domain);
      const indent = depth * 14;
      const barX = left + indent;
      const barW = usableW - indent;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink)
        .text(`${'  '.repeat(depth)}${g.name}`, left + indent, doc.y, { continued: true, width: barW - 60 });
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(`  [${g.domain || '—'}]`);
      drawProgressBar(doc, barX, doc.y + 2, barW, 12, pct, color, undefined, `${pct}%`);
      doc.y = doc.y + 18;
      if (g.customDetails) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted)
          .text(g.customDetails, left + indent + 4, doc.y, { width: barW - 8 });
        doc.moveDown(0.3);
      }
      for (const c of childrenOf(g.id)) render(c, depth + 1);
    };
    for (const g of rootGoals) render(g, 0);
  }
  doc.moveDown(0.6);

  if (input.goals.length > 0) {
    const byDomain: Record<string, number> = {};
    for (const g of input.goals) {
      const d = g.domain || 'Other';
      byDomain[d] = (byDomain[d] || 0) + 1;
    }
    const total = input.goals.length;
    const entries = Object.entries(byDomain).sort((a, b) => b[1] - a[1]);
    sectionTitle(doc, 'Life focus distribution', ACCENT2);
    const { left, right } = doc.page.margins;
    const usableW = doc.page.width - left - right;
    for (const [dom, count] of entries) {
      const pct = Math.round((count / total) * 100);
      drawProgressBar(doc, left, doc.y, usableW, 14, pct, domainColor(dom), dom, `${count} (${pct}%)`);
      doc.y += 18;
    }
    doc.moveDown(0.4);
  }

  const s2 = input.structured;
  if (s2) {
    const r = s2.recent || {};
    const dailyReduce = (rows: any[] | undefined, valueFn: (x: any) => number) => {
      if (!rows?.length) return [] as Array<{ label: string; value: number }>;
      const byDay: Record<string, number> = {};
      for (const x of rows) {
        const day = dateOnly(x.logged_at);
        if (!day) continue;
        byDay[day] = (byDay[day] || 0) + valueFn(x);
      }
      return Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-30)
        .map(([day, value]) => ({ label: day.slice(5), value }));
    };
    const charts: Array<{ title: string; series: any[]; accent: string }> = [];
    const stepsSeries = dailyReduce(r.steps, x => Number(x.steps) || 0);
    if (stepsSeries.length) charts.push({ title: 'Steps / day', series: stepsSeries, accent: '#10B981' });
    const sleepSeries = dailyReduce(r.sleep, x => Number(x.duration_h) || 0);
    if (sleepSeries.length) charts.push({ title: 'Sleep hours / night', series: sleepSeries, accent: COLORS.violet });
    const cardioSeries = dailyReduce(r.cardio, x => Number(x.duration_min) || 0);
    if (cardioSeries.length) charts.push({ title: 'Cardio minutes / day', series: cardioSeries, accent: '#EF4444' });
    const medSeries = dailyReduce(r.meditation, x => Number(x.duration_min) || 0);
    if (medSeries.length) charts.push({ title: 'Meditation minutes / day', series: medSeries, accent: COLORS.violetLt });
    const studySeries = dailyReduce(r.study, x => Number(x.duration_min) || 0);
    if (studySeries.length) charts.push({ title: 'Study minutes / day', series: studySeries, accent: ACCENT });
    const liftSeries = dailyReduce(r.lifts, x => Number(x.volume_kg) || 0);
    if (liftSeries.length) charts.push({ title: 'Lift volume kg / day', series: liftSeries, accent: '#DC2626' });

    if (charts.length > 0) {
      doc.addPage();
      sectionTitle(doc, 'Trends', ACCENT2);
      for (const c of charts) drawBarChart(doc, c.title, c.series, c.accent);
    }
  }

  if (input.structured) {
    doc.addPage();
    sectionTitle(doc, 'Tracker Data', ACCENT2);
    renderStructuredSection(doc, input.structured);
  }

  // ─── Legacy tracker rows rendered as prose, one line per entry. ──────
  if (input.legacyTrackerLogs.length > 0) {
    renderLegacyLogs(doc, input.legacyTrackerLogs);
  }

  if (input.timeline.length > 0) {
    doc.addPage();
    sectionTitle(doc, 'Life Logs', ACCENT2);
    const sorted = [...input.timeline].sort((a, b) => b.date.localeCompare(a.date));
    let currentDay = '';
    for (const e of sorted) {
      const day = dateOnly(e.date);
      if (day !== currentDay) {
        currentDay = day;
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT2)
          .text(fmtDate(day));
        doc.strokeColor(COLORS.line).lineWidth(0.3)
          .moveTo(doc.page.margins.left, doc.y + 1)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y + 1).stroke();
        doc.moveDown(0.2);
      }
      const time = new Date(e.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.muted).text(`${time}  `, { continued: true });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(ACCENT).text(`[${e.kind}] `, { continued: true });
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
