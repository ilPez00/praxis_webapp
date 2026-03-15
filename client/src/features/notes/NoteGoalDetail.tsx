import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Box, Typography, Chip, LinearProgress, Slider, TextField,
  Button, Collapse, IconButton, Tooltip, Popover, Stack, Divider,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import FlagIcon from '@mui/icons-material/Flag';
import TimelineIcon from '@mui/icons-material/Timeline';
import HistoryIcon from '@mui/icons-material/History';
import GlassCard from '../../components/common/GlassCard';
import { GoalNode as FrontendGoalNode, DOMAIN_COLORS, Domain } from '../../types/goal';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../trackers/trackerTypes';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

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

interface FieldConfig {
  key: string; label: string; type: 'number' | 'text';
  placeholder?: string; min?: number; max?: number; step?: number; unit?: string;
}

interface ObjectiveField {
  key: string; label: string; unit: string; placeholder: string; type: 'number' | 'text';
}

interface WidgetConfig {
  type: string; label: string; emoji: string; color: string;
  fields: FieldConfig[]; chartKey: string; chartUnit: string;
  objectives: ObjectiveField[]; domains: string[];
}

interface NoteGoalDetailProps {
  node: FrontendGoalNode;
  allNodes: any[];
  userId: string;
  activeBets: any[];
  onProgressUpdate: (nodeId: string, progress: number) => void;
  focusedTrackerType?: string | null;
}

// ── Widget config lookup (same as GoalWidgets but imported inline) ──────────

// Import the widget configs from GoalWidgets
import { findWidget, ALL_WIDGETS } from '../dashboard/components/GoalWidgets';
import type { WidgetGoalNode } from '../dashboard/components/GoalWidgets';

function getNodeDomain(nodeId: string, allNodes: any[]): string {
  const node = allNodes.find((n: any) => n.id === nodeId);
  if (!node) return 'Personal Goals';
  if (node.domain) return node.domain;
  if (!node.parentId) return 'Personal Goals';
  return getNodeDomain(node.parentId, allNodes);
}

// ── 7-day mini chart ────────────────────────────────────────────────────────

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
    <Box sx={{ mt: 1.5, mb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 72 }}>
        {days.map((day, i) => {
          const barH = Math.max((day.total / max) * 58, day.logged ? 10 : 3);
          return (
            <Tooltip key={i} title={`${day.label}: ${day.total > 0 ? `${day.total} ${unit}` : day.logged ? 'Logged' : 'No entry'}`} placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <Box sx={{
                  width: '100%', height: `${barH}px`,
                  borderRadius: '5px 5px 2px 2px',
                  background: day.logged
                    ? day.isToday
                      ? `linear-gradient(to bottom, ${color}, ${color}77)`
                      : `linear-gradient(to bottom, ${color}99, ${color}33)`
                    : 'rgba(255,255,255,0.05)',
                  transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: day.isToday && day.logged ? `0 0 12px ${color}55` : 'none',
                  position: 'relative',
                }}>
                  {day.isToday && day.logged && (
                    <Box sx={{
                      position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
                      width: 8, height: 8, borderRadius: '50%', bgcolor: color,
                      boxShadow: `0 0 10px ${color}, 0 0 20px ${color}88`,
                    }} />
                  )}
                </Box>
                <Typography sx={{
                  fontSize: '0.5rem',
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
      <Box sx={{ display: 'flex', gap: '3px', mt: 1 }}>
        {days.map((day, i) => (
          <Box key={i} sx={{
            flex: 1, height: 3, borderRadius: 2,
            background: day.logged
              ? day.isToday ? color : `${color}77`
              : 'rgba(255,255,255,0.07)',
          }} />
        ))}
      </Box>
    </Box>
  );
}

// ── Entry history timeline (git-commit style) ───────────────────────────────

function EntryTimeline({ entries, config, color }: {
  entries: TrackerEntry[]; config: WidgetConfig; color: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...entries].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  const visible = showAll ? sorted : sorted.slice(0, 10);

  if (sorted.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <HistoryIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.6)', mb: 1 }} />
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
          No entries yet — log your first session above
        </Typography>
      </Box>
    );
  }

  // Group entries by date
  const grouped: Record<string, TrackerEntry[]> = {};
  for (const e of sorted) {
    const dateKey = e.logged_at.slice(0, 10);
    (grouped[dateKey] ??= []).push(e);
  }
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const visibleDates = showAll ? dateKeys : dateKeys.slice(0, 7);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <HistoryIcon sx={{ fontSize: 14, color }} />
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Entry History
        </Typography>
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', ml: 'auto' }}>
          {sorted.length} total
        </Typography>
      </Box>

      {visibleDates.map((dateKey, di) => {
        const dayEntries = grouped[dateKey];
        const d = new Date(dateKey + 'T12:00:00');
        const isToday = dateKey === new Date().toISOString().slice(0, 10);
        const isYesterday = (() => {
          const y = new Date(); y.setDate(y.getDate() - 1);
          return dateKey === y.toISOString().slice(0, 10);
        })();
        const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });

        return (
          <Box key={dateKey} sx={{ position: 'relative', pl: 3, pb: 1 }}>
            {/* Timeline line */}
            <Box sx={{
              position: 'absolute', left: 8, top: 0, bottom: 0,
              width: 2, bgcolor: di === visibleDates.length - 1 ? 'transparent' : 'rgba(255,255,255,0.06)',
            }} />
            {/* Timeline dot */}
            <Box sx={{
              position: 'absolute', left: 4, top: 4,
              width: 10, height: 10, borderRadius: '50%',
              bgcolor: isToday ? color : `${color}55`,
              border: `2px solid ${isToday ? color : 'rgba(255,255,255,0.1)'}`,
              boxShadow: isToday ? `0 0 8px ${color}66` : 'none',
            }} />

            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: isToday ? color : 'rgba(255,255,255,0.5)', mb: 0.5 }}>
              {dateLabel}
            </Typography>

            {dayEntries.map((entry, ei) => (
              <Box key={ei} sx={{
                display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 0.5,
                p: '6px 10px', borderRadius: '8px',
                bgcolor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                {config.fields.map(f => {
                  const val = entry.data[f.key];
                  if (val === undefined || val === null || val === '') return null;
                  return (
                    <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>{f.label}:</Typography>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color }}>
                        {String(val)}{f.unit ? ` ${f.unit}` : ''}
                      </Typography>
                    </Box>
                  );
                }).filter(Boolean)}
                <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.75)', ml: 'auto' }}>
                  {new Date(entry.logged_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            ))}
          </Box>
        );
      })}

      {dateKeys.length > 7 && !showAll && (
        <Box
          onClick={() => setShowAll(true)}
          sx={{
            textAlign: 'center', py: 1, cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontWeight: 700,
            '&:hover': { color },
          }}
        >
          Show all {dateKeys.length} days...
        </Box>
      )}
    </Box>
  );
}

// ── Objective row ───────────────────────────────────────────────────────────

function ObjectiveRow({ config, currentGoal, onSave }: {
  config: WidgetConfig;
  currentGoal: Record<string, any>;
  onSave: (goal: Record<string, any>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const hasObjective = config.objectives.some(o => currentGoal[o.key]);

  const startEdit = () => {
    const init: Record<string, string> = {};
    config.objectives.forEach(o => { init[o.key] = currentGoal[o.key] ?? ''; });
    setDraft(init);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const merged: Record<string, any> = { ...currentGoal };
    config.objectives.forEach(o => {
      if (draft[o.key] !== '') {
        merged[o.key] = o.type === 'number' ? Number(draft[o.key]) : draft[o.key];
      }
    });
    await onSave(merged);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ mb: 1.5, p: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
          Set your objectives:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {config.objectives.map(o => (
            <TextField key={o.key} size="small" label={o.label + (o.unit ? ` (${o.unit})` : '')}
              type={o.type} placeholder={o.placeholder}
              value={draft[o.key] ?? ''} onChange={e => setDraft(prev => ({ ...prev, [o.key]: e.target.value }))}
              sx={{ flex: '1 1 120px', '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.78rem' }, '& .MuiInputLabel-root': { fontSize: '0.74rem' } }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <IconButton size="small" onClick={() => setEditing(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={handleSave} disabled={saving} sx={{ color: config.color }}>
            {saving ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
      <FlagIcon sx={{ fontSize: 12, color: config.color, opacity: 0.7 }} />
      {hasObjective ? (
        config.objectives.filter(o => currentGoal[o.key]).map(o => (
          <Chip key={o.key}
            label={`${o.label}: ${currentGoal[o.key]}${o.unit ? ' ' + o.unit : ''}`}
            size="small"
            sx={{ height: 16, fontSize: '0.58rem', bgcolor: `${config.color}15`, color: config.color, border: `1px solid ${config.color}25` }}
          />
        ))
      ) : (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', fontStyle: 'italic' }}>
          No objectives set
        </Typography>
      )}
      <Tooltip title="Edit objectives">
        <IconButton size="small" onClick={startEdit} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: config.color }, ml: 'auto', width: 20, height: 20 }}>
          <EditIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Full tracker widget (log form + chart + history for ANY tracker) ─────

function FullTrackerWidget({ trackerConfig, tracker, onLog, focused }: {
  trackerConfig: typeof TRACKER_TYPES[0];
  tracker: Tracker;
  onLog: () => void;
  focused?: boolean;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(focused ?? false);

  const color = trackerConfig.color;
  const allEntries = tracker.entries ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntries = allEntries.filter(e => e.logged_at.slice(0, 10) === todayKey);
  const loggedToday = todayEntries.length > 0;
  const latestEntry = todayEntries[0];
  const showForm = logOpen || !loggedToday;

  // Build fields from TRACKER_TYPES config
  const fields: FieldConfig[] = (trackerConfig.fields || []).map((f: any) => ({
    key: f.key, label: f.label, type: f.type || 'number',
    placeholder: f.placeholder, min: f.min, max: f.max, step: f.step, unit: f.unit,
  }));

  // Streak
  const streak = (() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (allEntries.some(e => e.logged_at.slice(0, 10) === key)) count++;
      else break;
    }
    return count;
  })();

  const handleLog = async () => {
    const data: Record<string, any> = {};
    for (const f of fields) {
      const val = form[f.key];
      if (val !== undefined && val !== '') data[f.key] = f.type === 'number' ? Number(val) : val;
    }
    if (Object.keys(data).length === 0) { toast.error('Enter at least one value.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/trackers/log`, { type: trackerConfig.id, data }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast.success(`${trackerConfig.icon} Logged! +1⚡`);
      setForm({});
      setLogOpen(false);
      onLog();
    } catch { toast.error('Failed to log. Try again.'); }
    finally { setSaving(false); }
  };

  // Auto-open log form when focused
  useEffect(() => {
    if (focused) setLogOpen(true);
  }, [focused]);

  return (
    <GlassCard sx={{
      p: 0, borderRadius: '18px', overflow: 'hidden', mb: 2,
      border: `1px solid ${loggedToday ? color + '60' : color + '30'}`,
      background: loggedToday
        ? `linear-gradient(160deg, ${color}18 0%, rgba(13,14,26,0.98) 100%)`
        : `linear-gradient(160deg, ${color}10 0%, rgba(13,14,26,0.98) 100%)`,
      boxShadow: focused ? `0 0 20px ${color}40` : loggedToday ? `0 4px 20px ${color}25` : '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'box-shadow 0.3s ease',
      // Mobile: larger padding
      '@media (max-width: 600px)': {
        p: 0,
        mb: 3,
      },
    }}>
      {/* Accent strip */}
      <Box sx={{
        height: 3,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: loggedToday ? 1 : 0.3,
      }} />

      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{
            width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
            bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${color}30`,
            boxShadow: loggedToday ? `0 0 10px ${color}30` : 'none',
          }}>
            <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{trackerConfig.icon}</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', flex: 1 }}>{trackerConfig.label}</Typography>
          {loggedToday && (
            <Chip icon={<CheckIcon sx={{ fontSize: '10px !important', color: '#10B981 !important' }} />}
              label="Logged" size="small"
              sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: '#10B98118', color: '#10B981', border: '1px solid #10B98133' }}
            />
          )}
          {streak > 1 && (
            <Chip icon={<LocalFireDepartmentIcon sx={{ fontSize: '10px !important', color: '#F59E0B !important' }} />}
              label={`${streak}d`} size="small"
              sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}
            />
          )}
        </Box>

        {/* Today's stat boxes */}
        {loggedToday && latestEntry && fields.length > 0 && (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(fields.filter(f => latestEntry.data[f.key] !== undefined && latestEntry.data[f.key] !== '').length || 1, 4)}, 1fr)`,
            gap: 0.75, mb: 1.5,
          }}>
            {fields.map(f => {
              const val = latestEntry.data[f.key];
              if (val === undefined || val === null || val === '') return null;
              return (
                <Box key={f.key} sx={{
                  textAlign: 'center', px: 0.75, py: 1,
                  background: `linear-gradient(135deg, ${color}15, ${color}08)`,
                  borderRadius: '10px', border: `1px solid ${color}22`,
                }}>
                  <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, color, lineHeight: 1, mb: 0.25 }}>
                    {String(val)}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {f.unit || f.label}
                  </Typography>
                </Box>
              );
            }).filter(Boolean)}
          </Box>
        )}

        {/* 7-day chart */}
        {fields.length > 0 && (
          <MiniChart
            entries={allEntries}
            chartKey={fields[0].key}
            color={color}
            unit={fields[0].unit || ''}
          />
        )}

        {/* Log form */}
        <Collapse in={showForm}>
          <Box sx={{ mt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.55rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                {loggedToday ? 'Log another' : "Log today's session"}
              </Typography>
              {loggedToday && (
                <IconButton size="small" onClick={() => setLogOpen(v => !v)} sx={{ color: 'rgba(255,255,255,0.6)', width: 20, height: 20, borderRadius: '6px' }}>
                  {logOpen ? <CloseIcon sx={{ fontSize: 11 }} /> : <AddIcon sx={{ fontSize: 11 }} />}
                </IconButton>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
              {fields.map(f => (
                <TextField key={f.key} size="small"
                  label={f.unit ? `${f.label} (${f.unit})` : f.label}
                  type={f.type} placeholder={f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  inputProps={{ min: f.min, max: f.max, step: f.step ?? (f.type === 'number' ? 1 : undefined) }}
                  sx={{
                    flex: f.type === 'text' ? '1 1 120px' : '0 1 80px',
                    '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem', '&.Mui-focused fieldset': { borderColor: color } },
                    '& .MuiInputLabel-root.Mui-focused': { color },
                    '& .MuiInputLabel-root': { fontSize: '0.72rem' },
                  }}
                />
              ))}
            </Box>
            <Button variant="contained" fullWidth onClick={handleLog} disabled={saving}
              endIcon={saving ? <CircularProgress size={12} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '13px !important' }} />}
              sx={{
                borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem', py: 1,
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                color: '#0A0B14', boxShadow: `0 3px 16px ${color}44`,
                '&:hover': { boxShadow: `0 5px 24px ${color}55`, transform: 'translateY(-1px)' },
                transition: 'all 0.15s ease',
              }}
            >
              {loggedToday ? 'Log again +1⚡' : 'Log +1⚡'}
            </Button>
          </Box>
        </Collapse>
      </Box>
    </GlassCard>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

const NoteGoalDetail: React.FC<NoteGoalDetailProps> = ({
  node, allNodes, userId, activeBets, onProgressUpdate, focusedTrackerType,
}) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  // Convert frontend node to backend format for findWidget
  const domain = getNodeDomain(node.id, allNodes);
  const backendNode = allNodes.find(n => n.id === node.id);
  const widgetNode: WidgetGoalNode = {
    id: node.id,
    name: node.title,
    domain: domain as string,
    category: backendNode?.category,
    progress: node.progress / 100,
    parentId: node.parentId,
  };
  const config = findWidget(widgetNode);
  const domainColor = (DOMAIN_COLORS as Record<string, string>)[domain] ?? '#8B5CF6';
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

  const tracker = config ? trackers.find(t => t.type === config.type) : undefined;
  const allEntries = tracker?.entries ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayEntries = allEntries.filter(e => e.logged_at.slice(0, 10) === todayKey);
  const loggedToday = todayEntries.length > 0;
  const latestEntry = todayEntries[0];
  const currentGoal = tracker?.goal ?? {};
  const showForm = logOpen || !loggedToday;
  const pct = node.progress;

  // Tracker streak
  const trackerStreak = (() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (allEntries.some(e => e.logged_at.slice(0, 10) === key)) count++;
      else break;
    }
    return count;
  })();

  const bet = activeBets.find(b => b.goal_node_id === node.id);
  const betDaysLeft = bet ? Math.ceil((new Date(bet.deadline).getTime() - Date.now()) / 86400000) : null;

  // Log handler
  const handleLog = async () => {
    if (!config) return;
    const data: Record<string, any> = {};
    for (const f of config.fields) {
      const val = form[f.key];
      if (val !== undefined && val !== '') data[f.key] = f.type === 'number' ? Number(val) : val;
    }
    if (Object.keys(data).length === 0) { toast.error('Enter at least one value.'); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/trackers/log`, { type: config.type, data }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast.success(`${config.emoji} Logged! +1⚡`);
      setForm({});
      setLogOpen(false);
      fetchTrackers();
    } catch { toast.error('Failed to log. Try again.'); }
    finally { setSaving(false); }
  };

  const handleObjectiveSaved = async (type: string, goal: Record<string, any>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(`${API_URL}/trackers/${type}/objective`, { goal }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setTrackers(prev => prev.map(t => t.type === type ? { ...t, goal } : t));
      toast.success('Objective saved!');
    } catch { toast.error('Failed to save objective.'); }
  };

  // Show ALL domain trackers — even ones not yet activated (empty entries)
  const domainTrackerIds = (DOMAIN_TRACKER_MAP as Record<string, string[]>)[domain] || [];
  const domainTrackers = domainTrackerIds
    .map(id => {
      const tt = TRACKER_TYPES.find(t => t.id === id);
      if (!tt) return null;
      const tr = trackers.find(t => t.type === id) ?? { id: '', type: id, goal: {}, entries: [] };
      return { config: tt, tracker: tr };
    })
    .filter(Boolean) as { config: typeof TRACKER_TYPES[0]; tracker: Tracker }[];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: accentColor }} />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2.5, pb: 3 }}>
      {/* ── Glowing progress card ── */}
      <GlassCard sx={{
        p: 0, borderRadius: '22px', overflow: 'hidden', mb: 2,
        border: `1px solid ${loggedToday ? accentColor + '50' : accentColor + '20'}`,
        background: loggedToday
          ? `linear-gradient(160deg, ${accentColor}14 0%, ${domainColor}08 60%, rgba(13,14,26,0.92) 100%)`
          : `linear-gradient(160deg, ${accentColor}08 0%, rgba(13,14,26,0.95) 100%)`,
        boxShadow: loggedToday ? `0 8px 40px ${accentColor}20, 0 0 0 1px ${accentColor}18` : 'none',
      }}>
        {/* Accent strip */}
        <Box sx={{
          height: 3,
          background: `linear-gradient(90deg, ${domainColor}00 0%, ${domainColor} 40%, ${accentColor} 70%, ${accentColor}00 100%)`,
          opacity: loggedToday ? 1 : 0.35,
        }} />

        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          {/* Header: icon + name + chips */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{
              width: 5, minHeight: 42, borderRadius: 3,
              background: `linear-gradient(to bottom, ${accentColor}, ${domainColor}77)`,
              flexShrink: 0, mt: 0.25, boxShadow: `0 0 10px ${accentColor}44`,
            }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                {config && (
                  <Box sx={{
                    width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
                    bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${accentColor}30`,
                    boxShadow: loggedToday ? `0 0 12px ${accentColor}30` : 'none',
                  }}>
                    <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{config.emoji}</Typography>
                  </Box>
                )}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', flex: 1 }} noWrap>
                  {node.title}
                </Typography>
                {loggedToday && (
                  <Chip icon={<CheckIcon sx={{ fontSize: '10px !important', color: '#10B981 !important' }} />}
                    label="Logged" size="small"
                    sx={{ height: 20, fontSize: '0.58rem', fontWeight: 700, bgcolor: '#10B98118', color: '#10B981', border: '1px solid #10B98133' }}
                  />
                )}
                {trackerStreak > 1 && (
                  <Chip icon={<LocalFireDepartmentIcon sx={{ fontSize: '10px !important', color: '#F59E0B !important' }} />}
                    label={`${trackerStreak}d`} size="small"
                    sx={{ height: 20, fontSize: '0.58rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}
                  />
                )}
              </Box>
              <Typography variant="caption" sx={{ color: domainColor, fontSize: '0.6rem', fontWeight: 700, opacity: 0.85, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {domain}
              </Typography>
            </Box>
          </Box>

          {/* Glowing progress bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.75 }}>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <LinearProgress variant="determinate" value={pct}
                sx={{
                  height: 10, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 5,
                    background: `linear-gradient(90deg, ${domainColor}bb, ${accentColor})`,
                    boxShadow: pct > 0 ? `0 0 10px ${accentColor}66` : 'none',
                  },
                }}
              />
              {pct > 2 && pct < 100 && (
                <Box sx={{
                  position: 'absolute', top: '50%', left: `${pct}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 10, height: 10, borderRadius: '50%', bgcolor: accentColor,
                  boxShadow: `0 0 8px ${accentColor}, 0 0 16px ${accentColor}66`,
                  pointerEvents: 'none',
                }} />
              )}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 900, color: accentColor, minWidth: 34, textAlign: 'right', fontSize: '0.88rem' }}>
              {pct}%
            </Typography>
          </Box>

          {/* Commitment badge */}
          {bet && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, px: 1.25, py: 0.75,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.06))',
              border: '1px solid rgba(139,92,246,0.22)',
            }}>
              <Typography variant="caption" sx={{ color: '#8B5CF6', fontWeight: 800, fontSize: '0.64rem' }}>
                🎰 {bet.stake_points} PP staked
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.6rem', ml: 0.5 }}>
                · {betDaysLeft !== null && betDaysLeft > 0 ? `${betDaysLeft}d left` : betDaysLeft === 0 ? 'Due today' : 'Deadline passed'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── Tracker section ── */}
        {config && (
          <Box sx={{ px: 2.5, pb: 2.5 }}>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

            {/* Today's stat boxes */}
            {loggedToday && latestEntry && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" sx={{
                  color: accentColor, fontSize: '0.58rem', letterSpacing: '0.1em',
                  textTransform: 'uppercase', fontWeight: 800, opacity: 0.85,
                }}>
                  Today
                </Typography>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(config.fields.filter(f => latestEntry.data[f.key] !== undefined && latestEntry.data[f.key] !== '').length, 4)}, 1fr)`,
                  gap: 1, mt: 1,
                }}>
                  {config.fields.map(f => {
                    const val = latestEntry.data[f.key];
                    if (val === undefined || val === null || val === '') return null;
                    return (
                      <Box key={f.key} sx={{
                        textAlign: 'center', px: 1, py: 1.5,
                        background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,
                        borderRadius: '14px', border: `1px solid ${accentColor}28`,
                        boxShadow: `0 2px 12px ${accentColor}14`,
                      }}>
                        <Typography sx={{
                          fontSize: f.type === 'text' ? '0.72rem' : '1.6rem',
                          fontWeight: 900, color: accentColor, lineHeight: 1, mb: 0.5,
                          wordBreak: 'break-word',
                        }}>
                          {String(val)}
                        </Typography>
                        <Typography variant="caption" sx={{
                          color: 'rgba(255,255,255,0.6)', fontSize: '0.56rem', display: 'block',
                          lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                          {f.unit || f.label}
                        </Typography>
                      </Box>
                    );
                  }).filter(Boolean)}
                </Box>
                {todayEntries.length > 1 && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.6rem', mt: 0.75, display: 'block' }}>
                    +{todayEntries.length - 1} more entr{todayEntries.length === 2 ? 'y' : 'ies'} today
                  </Typography>
                )}
              </Box>
            )}

            {/* Objectives */}
            <ObjectiveRow config={config} currentGoal={currentGoal} onSave={goal => handleObjectiveSaved(config.type, goal)} />

            {/* 7-day chart */}
            <MiniChart entries={allEntries} chartKey={config.chartKey} color={accentColor} unit={config.chartUnit} />

            {/* Quick log form */}
            <Collapse in={showForm}>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                  <Typography variant="caption" sx={{
                    color: 'rgba(255,255,255,0.6)', fontSize: '0.58rem', letterSpacing: '0.08em',
                    textTransform: 'uppercase', fontWeight: 700,
                  }}>
                    {loggedToday ? 'Log another session' : "Log today's session"}
                  </Typography>
                  {loggedToday && (
                    <IconButton size="small" onClick={() => setLogOpen(v => !v)} sx={{ color: 'rgba(255,255,255,0.6)', width: 22, height: 22, borderRadius: '6px' }}>
                      {logOpen ? <CloseIcon sx={{ fontSize: 12 }} /> : <AddIcon sx={{ fontSize: 12 }} />}
                    </IconButton>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.75 }}>
                  {config.fields.map(f => (
                    <TextField key={f.key} size="small"
                      label={f.unit ? `${f.label} (${f.unit})` : f.label}
                      type={f.type} placeholder={f.placeholder}
                      value={form[f.key] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      inputProps={{ min: f.min, max: f.max, step: f.step ?? (f.type === 'number' ? 1 : undefined) }}
                      sx={{
                        flex: f.type === 'text' ? '1 1 130px' : '0 1 88px',
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px', fontSize: '0.82rem',
                          '&.Mui-focused fieldset': { borderColor: accentColor },
                        },
                        '& .MuiInputLabel-root.Mui-focused': { color: accentColor },
                        '& .MuiInputLabel-root': { fontSize: '0.77rem' },
                      }}
                    />
                  ))}
                </Box>
                <Button variant="contained" fullWidth onClick={handleLog} disabled={saving}
                  endIcon={saving ? <CircularProgress size={13} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '15px !important' }} />}
                  sx={{
                    borderRadius: '12px', fontWeight: 800, fontSize: '0.82rem', py: 1.25,
                    background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                    color: '#0A0B14',
                    boxShadow: `0 4px 20px ${accentColor}44`,
                    '&:hover': { boxShadow: `0 6px 28px ${accentColor}55`, transform: 'translateY(-1px)' },
                    transition: 'all 0.15s ease',
                  }}
                >
                  {loggedToday ? 'Log again +1⚡' : 'Log today +1⚡'}
                </Button>
              </Box>
            </Collapse>
          </Box>
        )}
      </GlassCard>

      {/* ── All domain trackers as full widgets ── */}
      {domainTrackers.filter(dt => dt.config.id !== config?.type).map(dt => (
        <FullTrackerWidget
          key={dt.config.id}
          trackerConfig={dt.config}
          tracker={dt.tracker}
          onLog={fetchTrackers}
          focused={focusedTrackerType === dt.config.id}
        />
      ))}
    </Box>
  );
};

export default NoteGoalDetail;
