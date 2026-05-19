import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  entryCount: number;
  praxisPoints: number;
}

type ExportTier = 'raw' | 'axiom' | 'self-authoring' | 'rewrite';
type RawFormat = 'json' | 'md';

interface TierInfo {
  key: ExportTier;
  label: string;
  cost: string;
  desc: string;
  includes: string[];
  color: string;
}

const TIERS: TierInfo[] = [
  {
    key: 'raw',
    label: 'RAW EXPORT',
    cost: 'Free (1/day)',
    desc: 'Full notebook PDF with all entries, trackers, and analytics heatmap.',
    includes: ['All diary entries', 'Tracker data', 'Check-in heatmap', 'Commitment history', 'Goal tree snapshot'],
    color: '#aaaaaa',
  },
  {
    key: 'axiom',
    label: 'AXIOM NARRATIVE',
    cost: '300 PP',
    desc: 'Axiom reads your entire diary and writes a personal memoir — prose chapters, pull-quotes, coda.',
    includes: ['AI-authored memoir (3-5 chapters)', 'Mood arc analysis', 'Achievement highlights', 'Axiom coda (second-person reflection)', 'Styled PDF'],
    color: '#F59E0B',
  },
  {
    key: 'self-authoring',
    label: 'SELF-AUTHORING',
    cost: '500 PP',
    desc: 'Structured workbook: past analysis, present audit, future vision — based on your actual data.',
    includes: ['Past: pattern analysis from history', 'Present: current goal audit', 'Future: vision + action plan', 'Prompted exercises', 'Printable workbook PDF'],
    color: '#A78BFA',
  },
  {
    key: 'rewrite',
    label: 'INTELLIGENT REWRITE',
    cost: '150 PP',
    desc: 'Axiom rewrites your raw diary entries into clean, coherent prose — same events, better writing. Download as Markdown.',
    includes: ['Entries rewritten as clean prose', 'Preserves dates, moods, facts', 'Removes noise and typos', 'Adds narrative connective tissue', 'Markdown download'],
    color: '#22C55E',
  },
];

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DiaryExportDialog: React.FC<Props> = ({ open, onClose, entryCount, praxisPoints }) => {
  const [selected, setSelected] = useState<ExportTier>('raw');
  const [rawFormat, setRawFormat] = useState<RawFormat>('json');
  const [includeTrackers, setIncludeTrackers] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');

  const tier = TIERS.find(t => t.key === selected)!;
  const ppCost = selected === 'axiom' ? 300 : selected === 'self-authoring' ? 500 : selected === 'rewrite' ? 150 : 0;
  const canAfford = ppCost === 0 || praxisPoints >= ppCost;

  const handleExport = async () => {
    setSubmitting(true);
    setProgress('Preparing export…');
    try {
      if (selected === 'raw') {
        // Client-side JSON/MD export (already have entries in parent, but re-fetch for full data)
        setProgress('Fetching full diary data…');
        const [diaryRes, trackersRes, analyticsRes] = await Promise.allSettled([
          api.get('/diary/entries?limit=2000'),
          includeTrackers ? api.get('/trackers/my') : Promise.resolve(null),
          includeAnalytics ? api.get('/trackers/calendar?days=365') : Promise.resolve(null),
        ]);

        const entries = diaryRes.status === 'fulfilled'
          ? (diaryRes.value.data?.entries ?? diaryRes.value.data ?? [])
          : [];
        const trackers = (includeTrackers && trackersRes && 'value' in trackersRes && trackersRes.value)
          ? trackersRes.value?.data
          : null;
        const analytics = (includeAnalytics && analyticsRes && 'value' in analyticsRes && analyticsRes.value)
          ? analyticsRes.value?.data
          : null;

        const filtered = entries.filter((e: any) => {
          if (dateFrom && e.created_at < dateFrom) return false;
          if (dateTo && e.created_at > dateTo + 'T23:59:59') return false;
          return true;
        });

        setProgress('Building file…');
        let content: string;
        let filename: string;
        let mime: string;

        if (rawFormat === 'json') {
          content = JSON.stringify({
            exported_at: new Date().toISOString(),
            entry_count: filtered.length,
            entries: filtered,
            ...(trackers ? { trackers } : {}),
            ...(analytics ? { analytics } : {}),
          }, null, 2);
          filename = `praxis-diary-${new Date().toISOString().slice(0, 10)}.json`;
          mime = 'application/json';
        } else {
          const header = [
            `# Praxis Diary Export`,
            `_Exported ${new Date().toLocaleDateString()} · ${filtered.length} entries_\n`,
            dateFrom || dateTo ? `_Date range: ${dateFrom || 'all'} → ${dateTo || 'now'}_\n` : '',
          ].join('\n');

          const body = filtered.map((e: any) => [
            `## ${e.title || e.entry_type}`,
            `_${new Date(e.created_at).toLocaleString()}_ · **${e.entry_type}**${e.mood ? ` · ${e.mood}` : ''}${e.location_name ? ` · 📍 ${e.location_name}` : ''}`,
            '',
            e.content || '_no content_',
            e.tags?.length ? `\nTags: ${e.tags.join(', ')}` : '',
            '\n---',
          ].join('\n')).join('\n\n');

          const trackerSection = trackers ? [
            '\n\n# Tracker Data\n',
            '```json',
            JSON.stringify(trackers, null, 2),
            '```',
          ].join('\n') : '';

          const analyticsSection = analytics ? [
            '\n\n# Analytics\n',
            '```json',
            JSON.stringify(analytics, null, 2),
            '```',
          ].join('\n') : '';

          content = header + body + trackerSection + analyticsSection;
          filename = `praxis-diary-${new Date().toISOString().slice(0, 10)}.md`;
          mime = 'text/markdown';
        }

        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], { type: mime }));
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`Downloaded ${filename}`);
        onClose();

      } else if (selected === 'rewrite') {
        setProgress('Axiom is rewriting your diary… (30-60s)');
        const { data } = await api.post('/diary/export/rewrite', {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        const content = data?.markdown || data;
        const filename = `praxis-diary-rewritten-${new Date().toISOString().slice(0, 10)}.md`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('Rewrite downloaded!');
        onClose();

      } else {
        // PDF exports (axiom / self-authoring)
        setProgress(selected === 'axiom'
          ? 'Axiom is reading your diary and writing your memoir… (60-90s)'
          : 'Axiom is building your self-authoring workbook… (60-90s)');

        const endpoint = `/diary/export${selected === 'axiom' ? '/axiom' : '/self-authoring'}`;
        const response = await api.post(endpoint, {
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language || 'en-US',
        }, { responseType: 'blob' });

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `praxis-${selected}-${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PDF downloaded!');
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Export failed.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg bg-surface border border-border rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between">
          <div>
            <p className="font-mono text-xs font-bold text-amber tracking-widest">EXPORT DIARY</p>
            <p className="font-mono text-2xs text-dim mt-0.5">{entryCount} entries · {praxisPoints.toLocaleString()} PP available</p>
          </div>
          <button onClick={onClose} className="font-mono text-dim hover:text-fg text-lg leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Tier selector */}
          <div className="space-y-2">
            {TIERS.map(t => (
              <button
                key={t.key}
                onClick={() => setSelected(t.key)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected === t.key ? 'border-current bg-raised' : 'border-border hover:border-muted'
                }`}
                style={selected === t.key ? { borderColor: t.color } : {}}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-2xs font-bold tracking-widest" style={{ color: t.color }}>
                    {t.label}
                  </span>
                  <span className="font-mono text-2xs text-sub">{t.cost}</span>
                </div>
                <p className="font-mono text-xs text-sub leading-snug">{t.desc}</p>
                {selected === t.key && (
                  <ul className="mt-2 space-y-0.5">
                    {t.includes.map(inc => (
                      <li key={inc} className="flex items-center gap-1.5">
                        <span style={{ color: t.color }}><CheckIcon /></span>
                        <span className="font-mono text-2xs text-dim">{inc}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            ))}
          </div>

          {/* Options for raw */}
          {selected === 'raw' && (
            <div className="space-y-3 border-t border-border pt-3">
              <div>
                <p className="font-mono text-2xs text-dim tracking-widest mb-2">FORMAT</p>
                <div className="flex gap-2">
                  {(['json', 'md'] as RawFormat[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setRawFormat(f)}
                      className={`flex-1 py-1.5 rounded border font-mono text-xs transition-colors ${rawFormat === f ? 'border-fg text-fg' : 'border-border text-dim'}`}
                    >
                      .{f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={includeTrackers} onChange={e => setIncludeTrackers(e.target.checked)}
                    className="accent-amber w-3.5 h-3.5" />
                  <span className="font-mono text-xs text-sub">Tracker data</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={includeAnalytics} onChange={e => setIncludeAnalytics(e.target.checked)}
                    className="accent-amber w-3.5 h-3.5" />
                  <span className="font-mono text-xs text-sub">Analytics</span>
                </label>
              </div>
            </div>
          )}

          {/* Date range (all tiers) */}
          <div className="border-t border-border pt-3">
            <p className="font-mono text-2xs text-dim tracking-widest mb-2">DATE RANGE (optional)</p>
            <div className="flex gap-2">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="flex-1 bg-raised border border-border rounded px-2 py-1.5 font-mono text-xs text-fg focus:outline-none focus:border-amber/40" />
              <span className="font-mono text-xs text-dim self-center">→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="flex-1 bg-raised border border-border rounded px-2 py-1.5 font-mono text-xs text-fg focus:outline-none focus:border-amber/40" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-border space-y-2">
          {progress && (
            <p className="font-mono text-2xs text-amber text-center animate-pulse">{progress}</p>
          )}
          {!canAfford && (
            <p className="font-mono text-2xs text-red text-center">
              Need {ppCost} PP · you have {praxisPoints}
            </p>
          )}
          <button
            onClick={handleExport}
            disabled={submitting || !canAfford}
            className="w-full py-3 font-mono text-sm font-black rounded-lg transition-colors disabled:opacity-40"
            style={{ backgroundColor: canAfford ? tier.color : '#333', color: '#080808' }}
          >
            {submitting ? 'EXPORTING…' : ppCost > 0 ? `EXPORT · ${ppCost} PP` : 'EXPORT FREE'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DiaryExportDialog;
