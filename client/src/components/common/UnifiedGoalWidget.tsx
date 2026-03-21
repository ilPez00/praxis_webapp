import React, { useState, useEffect, useCallback, Component, ErrorInfo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Box, Typography, TextField, Button, Chip, LinearProgress, Slider,
  IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CheckIcon from '@mui/icons-material/Check';
import GlassCard from './GlassCard';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../../features/trackers/trackerTypes';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { findWidget } from '../../features/dashboard/components/GoalWidgets';
import type { WidgetGoalNode } from '../../features/dashboard/components/GoalWidgets';
import EditableTrackerForm from '../../features/trackers/EditableTrackerForm';

// ── Types ──────────────────────────────────────────────────────────────────

interface RawGoalNode {
  id: string;
  name: string;
  domain: string;
  progress: number; // 0-1
  parentId?: string;
  status?: string;
  weight?: number;
  category?: string;
}

interface TrackerEntry {
  id?: string;
  tracker_id: string;
  data: Record<string, any>;
  logged_at: string;
}

interface Tracker {
  id: string;
  type: string;
  goal: Record<string, any>;
  entries: TrackerEntry[];
}

interface UnifiedGoalWidgetProps {
  goal: RawGoalNode;
  allNodes: RawGoalNode[];
  userId: string;
  activeBets: any[];
  onSaved?: () => void;
}

const MOODS = [
  { emoji: '🔥', label: 'On fire' },
  { emoji: '💪', label: 'Strong' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😴', label: 'Tired' },
];

// ── Utils ──────────────────────────────────────────────────────────────────

function getNodeDomain(nodeId: string, allNodes: RawGoalNode[]): string {
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return 'Personal Goals';
  if (node.domain) return node.domain;
  if (!node.parentId) return 'Personal Goals';
  return getNodeDomain(node.parentId, allNodes);
}

// ── MiniChart ──────────────────────────────────────────────────────────────

function MiniChart({ entries, chartKey, color, unit }: {
  entries: TrackerEntry[]; chartKey: string; color: string; unit: string;
}) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en', { weekday: 'short' });
    const total = entries.filter(e => e.logged_at.slice(0, 10) === key)
      .reduce((s, e) => s + (Number(e.data[chartKey]) || 0), 0);
    const logged = entries.some(e => e.logged_at.slice(0, 10) === key);
    return { label, total, logged, isToday: i === 6 };
  });
  const max = Math.max(...days.map(d => d.total), 1);

  return (
    <Box sx={{ mt: 1, mb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 48 }}>
        {days.map((day, i) => {
          const barH = Math.max((day.total / max) * 38, day.logged ? 8 : 3);
          return (
            <Tooltip key={i} title={`${day.label}: ${day.total > 0 ? `${day.total} ${unit}` : day.logged ? 'Logged' : 'No entry'}`} placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1 }}>
                <Box sx={{
                  width: '100%', height: `${barH}px`,
                  borderRadius: '4px 4px 2px 2px',
                  background: day.logged
                    ? day.isToday
                      ? `linear-gradient(to bottom, ${color}, ${color}77)`
                      : `linear-gradient(to bottom, ${color}99, ${color}33)`
                    : 'rgba(255,255,255,0.05)',
                  transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: day.isToday && day.logged ? `0 0 8px ${color}55` : 'none',
                }} />
                <Typography sx={{
                  fontSize: '0.45rem',
                  color: day.isToday ? 'text.primary' : 'text.disabled',
                  fontWeight: day.isToday ? 800 : 400, lineHeight: 1,
                }}>
                  {day.isToday ? 'Now' : day.label.slice(0, 1)}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const UnifiedGoalWidget: React.FC<UnifiedGoalWidgetProps> = ({
  goal, allNodes, userId, activeBets, onSaved,
}) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const domain = getNodeDomain(goal.id, allNodes);
  const domainColor = (DOMAIN_COLORS as Record<string, string>)[domain] ?? '#8B5CF6';
  const domainIcon = (DOMAIN_ICONS as Record<string, string>)[domain] || '🎯';

  // Match widget config for this goal
  const widgetNode: WidgetGoalNode = {
    id: goal.id, name: goal.name, domain,
    category: goal.category, progress: goal.progress,
    parentId: goal.parentId,
  };
  const config = findWidget(widgetNode);
  const accentColor = config?.color ?? domainColor;

  // Fetch trackers
  const fetchTrackers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.get(`${API_URL}/trackers/my`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setTrackers(Array.isArray(res.data) ? res.data : []);
    } catch { setTrackers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrackers(); }, [fetchTrackers]);

  // Derived data
  const todayKey = new Date().toISOString().slice(0, 10);
  const pct = Math.round((goal.progress || 0) * 100);

  const bet = activeBets.find((b: any) => b.goal_node_id === goal.id);

  // ── Save journal entry (dual-write) ──────────────────────────────────────
  const handleSaveJournal = async () => {
    if (!note.trim() && !mood) { toast.error('Write a note or pick a mood.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const contentText = note.trim() || (mood ? `Mood: ${mood}` : '');

      // Legacy write
      await supabase.from('node_journal_entries').insert({
        user_id: userId, node_id: goal.id,
        note: contentText, mood, logged_at: new Date().toISOString(),
      });

      // Dual-write to notebook_entries
      await fetch(`${API_URL}/notebook/entries`, {
        method: 'POST', headers,
        body: JSON.stringify({
          entry_type: 'note', title: goal.name, content: contentText,
          mood: mood || undefined, goal_id: goal.id,
          domain: goal.domain || undefined, source_table: 'node_journal_entries',
        }),
      });

      toast.success(`Logged on "${goal.name}"!`);
      setNote('');
      setMood(null);
      onSaved?.();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally { setSaving(false); }
  };

  // Resolve ONE effective tracker: widget config match → first domain tracker fallback
  let effectiveTrackerConfig = config ? TRACKER_TYPES.find(t => t.id === config.type) ?? null : null;
  let effectiveTracker = effectiveTrackerConfig ? trackers.find(t => t.type === config!.type) : undefined;
  let effectiveType = config?.type;

  if (!effectiveTrackerConfig) {
    const domainTrackerIds = (DOMAIN_TRACKER_MAP as Record<string, string[]>)[domain] || [];
    for (const id of domainTrackerIds) {
      const tt = TRACKER_TYPES.find(t => t.id === id);
      if (tt) {
        effectiveTrackerConfig = tt;
        effectiveTracker = trackers.find(t => t.type === id) ?? { id: '', type: id, goal: {}, entries: [] };
        effectiveType = id;
        break;
      }
    }
  }

  const hasTracker = !!effectiveTrackerConfig;
  const effectiveEntries = effectiveTracker?.entries ?? [];
  const effectiveColor = (config?.color || effectiveTrackerConfig?.color) ?? accentColor;
  const anyLoggedToday = effectiveEntries.some(e => e.logged_at.slice(0, 10) === todayKey);
  const effectiveTodayCount = effectiveEntries.filter(e => e.logged_at.slice(0, 10) === todayKey).length;
  const DAILY_TRACKER_LIMIT = 3;
  const trackerLimitReached = effectiveTodayCount >= DAILY_TRACKER_LIMIT;

  const trackerStreak = (() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (effectiveEntries.some(e => e.logged_at.slice(0, 10) === key)) count++;
      else break;
    }
    return count;
  })();

  // Progress slider state
  const [progressDraft, setProgressDraft] = useState<number | null>(null);
  const [savingProgress, setSavingProgress] = useState(false);

  const handleSaveProgress = async (newPct: number) => {
    setSavingProgress(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      await fetch(`${API_URL}/goals/${userId}/node/${goal.id}/progress`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ progress: newPct / 100 }),
      });
      toast.success(`Progress updated to ${newPct}%`);
      setProgressDraft(null);
    } catch { toast.error('Failed to update progress'); }
    finally { setSavingProgress(false); }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: accentColor }} />
      </Box>
    );
  }

  return (
    <GlassCard sx={{
      p: 0, borderRadius: '20px', overflow: 'hidden',
      border: `1px solid ${anyLoggedToday ? accentColor + '40' : 'rgba(255,255,255,0.08)'}`,
      background: anyLoggedToday
        ? `linear-gradient(160deg, ${accentColor}12 0%, rgba(13,14,26,0.94) 100%)`
        : 'rgba(17,24,39,0.82)',
      boxShadow: anyLoggedToday ? `0 4px 24px ${accentColor}18` : undefined,
      '&:hover': { transform: 'none' },
    }}>
      {/* ── Accent bar ── */}
      <Box sx={{
        height: 3,
        background: `linear-gradient(90deg, ${domainColor}00, ${accentColor}, ${domainColor}00)`,
        opacity: anyLoggedToday ? 1 : 0.3,
      }} />

      {/* ── Header: name + progress ── */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: '1.3rem' }}>{domainIcon}</Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }} noWrap>
              {goal.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
              <Typography sx={{ fontSize: '0.6rem', color: domainColor, fontWeight: 700, textTransform: 'uppercase' }}>
                {domain}
              </Typography>
              {trackerStreak > 1 && (
                <Chip
                  icon={<LocalFireDepartmentIcon sx={{ fontSize: '10px !important' }} />}
                  label={`${trackerStreak}d streak`}
                  size="small"
                  sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}
                />
              )}
              {anyLoggedToday && (
                <Chip
                  icon={<CheckIcon sx={{ fontSize: '10px !important' }} />}
                  label="Today"
                  size="small"
                  sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: '#10B98115', color: '#10B981' }}
                />
              )}
            </Box>
          </Box>
          <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: accentColor }}>
            {pct}%
          </Typography>
        </Box>

        {/* Progress bar */}
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 8, borderRadius: 4,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: `linear-gradient(90deg, ${domainColor}bb, ${accentColor})`,
            },
          }}
        />

        {/* Progress slider — tap to adjust */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          <Slider
            value={progressDraft ?? pct}
            onChange={(_, v) => setProgressDraft(v as number)}
            onChangeCommitted={(_, v) => handleSaveProgress(v as number)}
            disabled={savingProgress}
            sx={{
              flex: 1, color: accentColor, height: 6,
              '& .MuiSlider-thumb': {
                width: 16, height: 16,
                '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 8px ${accentColor}55` },
              },
              '& .MuiSlider-rail': { opacity: 0.15 },
            }}
          />
          <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', minWidth: 50, textAlign: 'right' }}>
            {savingProgress ? 'Saving...' : 'Drag to update'}
          </Typography>
        </Box>

        {/* Bet indicator */}
        {bet && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, px: 1, py: 0.5, borderRadius: '8px', bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#8B5CF6' }}>
              🎰 {bet.stake_points} PP staked
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Inline Full Log form (default view) ── */}
      {hasTracker && (
        <Box sx={{ px: 2.5, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {effectiveTrackerConfig?.icon} {effectiveTrackerConfig?.label || 'Log'}
            </Typography>
            <Typography sx={{ fontSize: '0.55rem', color: trackerLimitReached ? '#F59E0B' : 'rgba(255,255,255,0.3)' }}>
              · {effectiveTodayCount}/{DAILY_TRACKER_LIMIT} today
            </Typography>
          </Box>
          {trackerLimitReached ? (
            <Box sx={{
              p: 2, borderRadius: '12px', textAlign: 'center',
              bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
            }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#F59E0B', mb: 0.5 }}>
                Daily limit reached
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                {DAILY_TRACKER_LIMIT} tracker logs per goal per day. Notes below are unlimited.
              </Typography>
            </Box>
          ) : (
            <EditableTrackerForm
              open={true}
              onClose={() => {}}
              inline
              accentColor={effectiveColor}
              tracker={effectiveTracker ? { ...effectiveTracker, def: effectiveTrackerConfig! } : { id: '', type: effectiveType || '', def: effectiveTrackerConfig!, goal: {}, entries: [] }}
              onSave={async (data) => {
                if (!effectiveType) return;
                const { data: { session } } = await supabase.auth.getSession();
                const res = await axios.post(`${API_URL}/trackers/log`, { type: effectiveType, data }, {
                  headers: { Authorization: `Bearer ${session?.access_token}` },
                });
                if (res.data?.limitReached) {
                  toast.error('Daily limit reached (3 per goal)');
                  return;
                }
                const pp = res.data?.ppAwarded || 1;
                toast.success(`Logged! +${pp} PP`);
                fetchTrackers();
              }}
              saving={saving}
            />
          )}
        </Box>
      )}

      {/* ── Mood picker ── */}
      <Box sx={{ px: 2.5, pt: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          {MOODS.map(m => (
            <Chip
              key={m.emoji}
              label={m.emoji}
              size="small"
              onClick={() => setMood(mood === m.emoji ? null : m.emoji)}
              sx={{
                fontSize: '0.85rem', width: 36, height: 30,
                bgcolor: mood === m.emoji ? `${accentColor}25` : 'rgba(255,255,255,0.04)',
                border: mood === m.emoji ? `1px solid ${accentColor}50` : '1px solid transparent',
                cursor: 'pointer',
                '& .MuiChip-label': { px: 0 },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            />
          ))}
        </Box>

        {/* ── Journal input + send ── */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 1.5 }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            size="small"
            placeholder="What did you do?"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && (note.trim() || mood)) {
                e.preventDefault();
                handleSaveJournal();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: 'rgba(255,255,255,0.04)',
                fontSize: '0.85rem',
              },
            }}
          />
          <IconButton
            onClick={handleSaveJournal}
            disabled={saving || (!note.trim() && !mood)}
            sx={{
              bgcolor: accentColor,
              color: '#0D0E1A',
              width: 38, height: 38, borderRadius: '12px',
              '&:hover': { bgcolor: accentColor, filter: 'brightness(1.15)' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)' },
            }}
          >
            {saving ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>
      </Box>

      {/* ── 7-day mini chart (collapsed below form) ── */}
      {hasTracker && effectiveEntries.length > 0 && (() => {
        const chartKey = config?.chartKey
          || effectiveTrackerConfig?.fields.find(f => f.type === 'number')?.key
          || 'value';
        const chartUnit = config?.chartUnit
          || effectiveTrackerConfig?.fields.find(f => f.type === 'number')?.label
          || '';
        return (
          <Box sx={{ px: 2.5, pb: 0.5 }}>
            <MiniChart entries={effectiveEntries} chartKey={chartKey} color={effectiveColor} unit={chartUnit} />
          </Box>
        );
      })()}
    </GlassCard>
  );
};

// ── Error Boundary ─────────────────────────────────────────────────────────

class WidgetErrorBoundary extends Component<
  { children: React.ReactNode; goalName: string },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UnifiedGoalWidget] crash:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography sx={{ color: 'error.main', fontWeight: 700, mb: 1 }}>
            Widget failed to load
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {this.state.error}
          </Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

const UnifiedGoalWidgetSafe: React.FC<UnifiedGoalWidgetProps> = (props) => (
  <WidgetErrorBoundary goalName={props.goal.name}>
    <UnifiedGoalWidget {...props} />
  </WidgetErrorBoundary>
);

export default UnifiedGoalWidgetSafe;
