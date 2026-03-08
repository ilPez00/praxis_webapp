import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, TextField, Chip, CircularProgress,
  Tooltip, IconButton, Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import VerifiedIcon from '@mui/icons-material/Verified';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GlassCard from '../../../components/common/GlassCard';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import { Domain } from '../../../models/Domain';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GoalNode { id: string; name: string; domain?: string; progress?: number }
interface TrackerEntry { tracker_id: string; data: Record<string, any>; logged_at: string }
interface Tracker { id: string; type: string; entries: TrackerEntry[] }
interface ActiveBet { id: string; goal_node_id: string; stake_points: number; deadline: string; goal_title?: string }
interface ActiveChallenge { id: string; title: string; description?: string; domain?: string; end_date?: string; progress?: number }

interface Props {
  userId: string;
  allNodes: GoalNode[];
  activeBets?: ActiveBet[];
  activeChallenges?: ActiveChallenge[];
}

// ── Widget config per domain ───────────────────────────────────────────────────

interface FieldConfig {
  key: string;
  label: string;
  type: 'number' | 'text';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

interface WidgetConfig {
  type: string;         // tracker type key (unique per user)
  label: string;
  emoji: string;
  color: string;
  fields: FieldConfig[];
  chartKey: string;     // which field drives the bar chart
  chartUnit: string;
}

const DOMAIN_WIDGETS: Partial<Record<string, WidgetConfig[]>> = {
  [Domain.FITNESS]: [
    {
      type: 'workout', label: 'Workout', emoji: '🏋️', color: '#F97316',
      fields: [
        { key: 'exercise', label: 'Exercise', type: 'text', placeholder: 'e.g. Bench press' },
        { key: 'sets', label: 'Sets', type: 'number', min: 1, max: 20 },
        { key: 'reps', label: 'Reps', type: 'number', min: 1, max: 200 },
        { key: 'weight', label: 'kg', type: 'number', min: 0, max: 500, step: 0.5 },
      ],
      chartKey: 'weight', chartUnit: 'kg',
    },
    {
      type: 'steps', label: 'Steps', emoji: '👟', color: '#10B981',
      fields: [{ key: 'steps', label: 'Steps today', type: 'number', min: 0, max: 100000 }],
      chartKey: 'steps', chartUnit: 'steps',
    },
    {
      type: 'body_weight', label: 'Body Weight', emoji: '⚖️', color: '#60A5FA',
      fields: [{ key: 'weight_kg', label: 'kg', type: 'number', min: 30, max: 300, step: 0.1 }],
      chartKey: 'weight_kg', chartUnit: 'kg',
    },
  ],
  [Domain.ACADEMICS]: [
    {
      type: 'study', label: 'Study Session', emoji: '📚', color: '#8B5CF6',
      fields: [
        { key: 'hours', label: 'Hours', type: 'number', min: 0, max: 16, step: 0.5 },
        { key: 'pages', label: 'Pages', type: 'number', min: 0, max: 1000 },
        { key: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g. Math' },
      ],
      chartKey: 'hours', chartUnit: 'hrs',
    },
  ],
  [Domain.INVESTING]: [
    {
      type: 'savings', label: 'Savings Log', emoji: '💰', color: '#F59E0B',
      fields: [
        { key: 'amount', label: 'Amount (€)', type: 'number', min: 0, step: 0.01 },
        { key: 'note', label: 'What for?', type: 'text', placeholder: 'e.g. Index fund' },
      ],
      chartKey: 'amount', chartUnit: '€',
    },
  ],
  [Domain.MENTAL_HEALTH]: [
    {
      type: 'mindfulness', label: 'Mindfulness', emoji: '🧘', color: '#A78BFA',
      fields: [
        { key: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 240 },
        { key: 'type', label: 'Type', type: 'text', placeholder: 'e.g. Meditation' },
      ],
      chartKey: 'minutes', chartUnit: 'min',
    },
  ],
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: [
    {
      type: 'creative', label: 'Practice', emoji: '🎨', color: '#EC4899',
      fields: [
        { key: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 480 },
        { key: 'activity', label: 'Activity', type: 'text', placeholder: 'e.g. Guitar' },
      ],
      chartKey: 'minutes', chartUnit: 'min',
    },
  ],
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: [
    {
      type: 'reflection', label: 'Reflection', emoji: '📖', color: '#6366F1',
      fields: [
        { key: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 180 },
        { key: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g. Stoicism' },
      ],
      chartKey: 'minutes', chartUnit: 'min',
    },
  ],
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: [
    {
      type: 'social', label: 'Connections', emoji: '🤝', color: '#34D399',
      fields: [
        { key: 'count', label: 'Interactions', type: 'number', min: 1, max: 100 },
        { key: 'note', label: 'With who?', type: 'text', placeholder: 'e.g. Gym buddy' },
      ],
      chartKey: 'count', chartUnit: 'interactions',
    },
  ],
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: [
    {
      type: 'quality_time', label: 'Quality Time', emoji: '💞', color: '#F472B6',
      fields: [{ key: 'minutes', label: 'Minutes', type: 'number', min: 1, max: 480 }],
      chartKey: 'minutes', chartUnit: 'min',
    },
  ],
  [Domain.CAREER]: [
    {
      type: 'deep_work', label: 'Deep Work', emoji: '⚡', color: '#FBBF24',
      fields: [
        { key: 'hours', label: 'Hours', type: 'number', min: 0, max: 16, step: 0.5 },
        { key: 'task', label: 'What did you build?', type: 'text', placeholder: 'e.g. Finished API' },
      ],
      chartKey: 'hours', chartUnit: 'hrs',
    },
  ],
  [Domain.PERSONAL_GOALS]: [
    {
      type: 'progress_log', label: 'Progress', emoji: '🎯', color: '#60A5FA',
      fields: [
        { key: 'value', label: 'Value', type: 'number', min: 0 },
        { key: 'note', label: 'What did you do?', type: 'text', placeholder: 'e.g. 3 reps more' },
      ],
      chartKey: 'value', chartUnit: 'units',
    },
  ],
};

// ── Mini bar chart ────────────────────────────────────────────────────────────

function MiniChart({ entries, chartKey, color, unit }: {
  entries: TrackerEntry[];
  chartKey: string;
  color: string;
  unit: string;
}) {
  // Build last 7 days buckets
  const days: { label: string; total: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Yest' : d.toLocaleDateString('en', { weekday: 'short' });
    const total = entries
      .filter(e => e.logged_at.slice(0, 10) === key)
      .reduce((sum, e) => sum + (Number(e.data[chartKey]) || 0), 0);
    days.push({ label: dayLabel, total });
  }

  const max = Math.max(...days.map(d => d.total), 1);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 36, mt: 1.5, mb: 0.5 }}>
      {days.map((day, i) => (
        <Tooltip key={i} title={`${day.label}: ${day.total} ${unit}`} placement="top">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
            <Box sx={{
              width: '100%',
              height: `${Math.max((day.total / max) * 28, day.total > 0 ? 4 : 2)}px`,
              bgcolor: day.total > 0 ? color : 'rgba(255,255,255,0.06)',
              borderRadius: '3px 3px 0 0',
              opacity: i === 6 ? 1 : 0.65,
              transition: 'height 0.3s ease',
            }} />
            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', lineHeight: 1 }}>
              {day.label.slice(0, 3)}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

// ── Single tracker card ────────────────────────────────────────────────────────

function TrackerCard({ config, tracker, userId, onLogged }: {
  config: WidgetConfig;
  tracker?: Tracker;
  userId: string;
  onLogged: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntries = (tracker?.entries ?? []).filter(e => e.logged_at.slice(0, 10) === todayKey);
  const loggedToday = todayEntries.length > 0;

  const handleLog = async () => {
    const data: Record<string, any> = {};
    for (const f of config.fields) {
      const val = form[f.key];
      if (val === undefined || val === '') continue;
      data[f.key] = f.type === 'number' ? Number(val) : val;
    }
    if (Object.keys(data).length === 0) { toast.error('Enter at least one value.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/trackers/log`, { type: config.type, data }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast.success(`+5 ⚡ ${config.label} logged!`);
      setForm({});
      setExpanded(false);
      onLogged();
    } catch {
      toast.error('Failed to log. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard sx={{
      p: 2.5,
      borderRadius: '16px',
      border: `1px solid ${config.color}22`,
      background: `linear-gradient(135deg, ${config.color}08 0%, rgba(17,24,39,0.7) 100%)`,
      transition: 'border-color 0.2s',
      '&:hover': { borderColor: `${config.color}44` },
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>{config.emoji}</Typography>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.2, color: config.color }}>
              {config.label}
            </Typography>
            {loggedToday && (
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600, fontSize: '0.65rem' }}>
                ✓ Logged today
              </Typography>
            )}
          </Box>
        </Box>
        <Tooltip title={expanded ? 'Hide' : 'Log now'}>
          <IconButton
            size="small"
            onClick={() => setExpanded(v => !v)}
            sx={{
              bgcolor: expanded ? `${config.color}22` : 'rgba(255,255,255,0.04)',
              color: config.color,
              '&:hover': { bgcolor: `${config.color}33` },
              width: 28, height: 28,
            }}
          >
            {expanded ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* 7-day bar chart */}
      {(tracker?.entries ?? []).length > 0 && (
        <MiniChart
          entries={tracker!.entries}
          chartKey={config.chartKey}
          color={config.color}
          unit={config.chartUnit}
        />
      )}

      {/* Today's total if logged */}
      {loggedToday && (() => {
        const total = todayEntries.reduce((s, e) => s + (Number(e.data[config.chartKey]) || 0), 0);
        return total > 0 ? (
          <Typography variant="caption" sx={{ color: config.color, fontWeight: 700, fontSize: '0.7rem' }}>
            Today: {total} {config.chartUnit}
          </Typography>
        ) : null;
      })()}

      {/* Log form */}
      {expanded && (
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {config.fields.map(f => (
              <TextField
                key={f.key}
                size="small"
                label={f.label}
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key] ?? ''}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                inputProps={{ min: f.min, max: f.max, step: f.step ?? 1 }}
                sx={{
                  flex: f.type === 'text' ? '1 1 120px' : '0 1 80px',
                  '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.82rem' },
                  '& .MuiInputLabel-root': { fontSize: '0.78rem' },
                }}
              />
            ))}
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={handleLog}
            disabled={saving}
            endIcon={saving ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
            sx={{
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.75rem',
              background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}cc 100%)`,
              color: '#0A0B14',
              alignSelf: 'flex-end',
              px: 2,
            }}
          >
            Log +5⚡
          </Button>
        </Box>
      )}
    </GlassCard>
  );
}

// ── Challenges mini-row ────────────────────────────────────────────────────────

function ChallengesRow({ challenges, onNavigate }: { challenges: ActiveChallenge[]; onNavigate: () => void }) {
  if (challenges.length === 0) return null;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEventsIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
          <Typography variant="body2" sx={{ fontWeight: 800, color: '#F59E0B' }}>Active Challenges</Typography>
        </Box>
        <Tooltip title="View all challenges">
          <IconButton size="small" onClick={onNavigate} sx={{ color: 'text.disabled', '&:hover': { color: '#F59E0B' } }}>
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Stack spacing={1}>
        {challenges.slice(0, 3).map(c => (
          <GlassCard key={c.id} sx={{ p: 2, borderRadius: '12px', border: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmojiEventsIcon sx={{ fontSize: 18, color: '#F59E0B', flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.2 }} noWrap>
                  {c.title}
                </Typography>
                {c.end_date && (
                  <Typography variant="caption" color="text.disabled">
                    Ends {new Date(c.end_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </Typography>
                )}
              </Box>
              {c.domain && (
                <Chip label={c.domain} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.05)' }} />
              )}
            </Box>
          </GlassCard>
        ))}
      </Stack>
    </Box>
  );
}

// ── Commitments (bets) mini-row ────────────────────────────────────────────────

function CommitmentsRow({ bets, nodes, onNavigate }: {
  bets: ActiveBet[];
  nodes: GoalNode[];
  onNavigate: () => void;
}) {
  if (bets.length === 0) return null;
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VerifiedIcon sx={{ fontSize: 16, color: '#8B5CF6' }} />
          <Typography variant="body2" sx={{ fontWeight: 800, color: '#8B5CF6' }}>Commitments</Typography>
        </Box>
        <Tooltip title="View all commitments">
          <IconButton size="small" onClick={onNavigate} sx={{ color: 'text.disabled', '&:hover': { color: '#8B5CF6' } }}>
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Stack spacing={1}>
        {bets.slice(0, 3).map(bet => {
          const node = nodeMap[bet.goal_node_id];
          const daysLeft = Math.ceil((new Date(bet.deadline).getTime() - Date.now()) / 86400000);
          const progress = node ? Math.round((node.progress ?? 0) * 100) : 0;
          return (
            <GlassCard key={bet.id} sx={{ p: 2, borderRadius: '12px', border: '1px solid rgba(139,92,246,0.15)', background: 'rgba(139,92,246,0.04)' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <VerifiedIcon sx={{ fontSize: 18, color: '#8B5CF6', flexShrink: 0, mt: 0.1 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.2 }} noWrap>
                    {node?.name ?? 'Goal'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: '#8B5CF6', borderRadius: 2, transition: 'width 0.5s' }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#8B5CF6', fontWeight: 700, fontSize: '0.65rem', flexShrink: 0 }}>
                      {progress}%
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem' }}>
                    ⚡ {bet.stake_points} PP · {daysLeft > 0 ? `${daysLeft}d left` : 'Deadline passed'}
                  </Typography>
                </Box>
              </Box>
            </GlassCard>
          );
        })}
      </Stack>
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const GoalWidgets: React.FC<Props> = ({ userId, allNodes, activeBets = [], activeChallenges = [] }) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrackers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.get(`${API_URL}/trackers/my`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setTrackers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTrackers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrackers(); }, [fetchTrackers]);

  // Determine which domains the user has goals in
  const userDomains = Array.from(new Set(
    allNodes.map(n => n.domain).filter(Boolean) as string[]
  ));

  // Collect applicable widget configs from user's domains
  const widgetConfigs: WidgetConfig[] = [];
  for (const domain of userDomains) {
    const configs = DOMAIN_WIDGETS[domain];
    if (configs) widgetConfigs.push(...configs);
  }

  // If no domain goals yet, show first 3 defaults (Fitness, Academics, Career)
  if (widgetConfigs.length === 0) {
    const defaults = [Domain.FITNESS, Domain.ACADEMICS, Domain.CAREER];
    for (const d of defaults) {
      const configs = DOMAIN_WIDGETS[d];
      if (configs) widgetConfigs.push(configs[0]);
    }
  }

  const trackerMap = Object.fromEntries(trackers.map(t => [t.type, t]));
  const hasContent = widgetConfigs.length > 0 || activeBets.length > 0 || activeChallenges.length > 0;

  if (!hasContent) return null;

  return (
    <Box sx={{ mb: 4 }}>
      {/* Section header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TrendingUpIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="body1" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Today's Tracking
        </Typography>
        <Chip
          label={`${userDomains.length} domain${userDomains.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Tracker widgets grid */}
          {widgetConfigs.length > 0 && (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}>
              {widgetConfigs.map(config => (
                <TrackerCard
                  key={config.type}
                  config={config}
                  tracker={trackerMap[config.type]}
                  userId={userId}
                  onLogged={fetchTrackers}
                />
              ))}
            </Box>
          )}

          {/* Challenges + Commitments row */}
          {(activeChallenges.length > 0 || activeBets.length > 0) && (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
              gap: 2,
            }}>
              {activeChallenges.length > 0 && (
                <GlassCard sx={{ p: 2.5, borderRadius: '16px', border: '1px solid rgba(245,158,11,0.12)' }}>
                  <ChallengesRow
                    challenges={activeChallenges}
                    onNavigate={() => window.location.href = '/challenges'}
                  />
                </GlassCard>
              )}
              {activeBets.length > 0 && (
                <GlassCard sx={{ p: 2.5, borderRadius: '16px', border: '1px solid rgba(139,92,246,0.12)' }}>
                  <CommitmentsRow
                    bets={activeBets}
                    nodes={allNodes}
                    onNavigate={() => window.location.href = '/commitments'}
                  />
                </GlassCard>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default GoalWidgets;
