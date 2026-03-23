import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Typography, Chip, LinearProgress, TextField,
  Button, IconButton, Tooltip, Stack, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import FlagIcon from '@mui/icons-material/Flag';
import HistoryIcon from '@mui/icons-material/History';
import RemoveIcon from '@mui/icons-material/Remove';
import GlassCard from '../../components/common/GlassCard';
import GoalActivityGraph from './GoalActivityGraph';
import { GoalNode as FrontendGoalNode, DOMAIN_COLORS } from '../../types/goal';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../trackers/trackerTypes';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import EditableTrackerForm from '../trackers/EditableTrackerForm';
import { findWidget } from '../dashboard/components/GoalWidgets';
import type { WidgetGoalNode } from '../dashboard/components/GoalWidgets';

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

interface WidgetConfig {
  type: string; label: string; emoji: string; color: string;
  fields: any[]; chartKey: string; chartUnit: string;
  objectives: any[]; domains: string[];
}

interface NoteGoalDetailProps {
  node: FrontendGoalNode;
  allNodes: any[];
  userId: string;
  activeBets: any[];
  onProgressUpdate: (nodeId: string, progress: number) => void;
  focusedTrackerType?: string | null;
}

// ── Utils ────────────────────────────────────────────────────────────────────

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

// ── Objective row ───────────────────────────────────────────────────────────

function ObjectiveRow({ config, currentGoal, onSave }: {
  config: any;
  currentGoal: Record<string, any>;
  onSave: (goal: Record<string, any>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  
  if (!config) return null;
  
  const objectives: any[] = config.objectives || [];
  const hasObjective = objectives.some(o => currentGoal[o.key]);
  const configColor = config.color || '#8B5CF6';

  const startEdit = () => {
    const init: Record<string, string> = {};
    objectives.forEach(o => { init[o.key] = currentGoal[o.key] ?? ''; });
    setDraft(init);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const merged: Record<string, any> = { ...currentGoal };
    objectives.forEach(o => {
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
          {objectives.map(o => (
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
          <IconButton size="small" onClick={handleSave} disabled={saving} sx={{ color: configColor }}>
            {saving ? <CircularProgress size={12} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
      <FlagIcon sx={{ fontSize: 12, color: configColor, opacity: 0.7 }} />
      {hasObjective ? (
        objectives.filter(o => currentGoal[o.key]).map(o => (
          <Chip key={o.key}
            label={`${o.label}: ${currentGoal[o.key]}${o.unit ? ' ' + o.unit : ''}`}
            size="small"
            sx={{ height: 16, fontSize: '0.58rem', bgcolor: `${configColor}15`, color: configColor, border: `1px solid ${configColor}25` }}
          />
        ))
      ) : (
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem', fontStyle: 'italic' }}>
          No objectives set
        </Typography>
      )}
      <Tooltip title="Edit objectives">
        <IconButton size="small" onClick={startEdit} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: configColor }, ml: 'auto', width: 20, height: 20 }}>
          <EditIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}


// ── Main component ──────────────────────────────────────────────────────────

const NoteGoalDetail: React.FC<NoteGoalDetailProps> = ({
  node, allNodes, userId, activeBets, onProgressUpdate, focusedTrackerType,
}) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchTrackers = useCallback(async () => {
    try {
      const res = await api.get('/trackers/my');
      setTrackers(Array.isArray(res.data) ? res.data : []);
    } catch { setTrackers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrackers(); }, [fetchTrackers]);

  // Resolve tracker config: widget types (lose_weight) don't match tracker IDs (lift),
  // so fall back to the first domain tracker if direct match fails
  let resolvedTrackerConfig = config ? TRACKER_TYPES.find(t => t.id === config.type) ?? null : null;
  let resolvedTracker = resolvedTrackerConfig ? trackers.find(t => t.type === resolvedTrackerConfig!.id) : undefined;
  if (!resolvedTrackerConfig) {
    const domainIds = (DOMAIN_TRACKER_MAP as Record<string, string[]>)[domain] || [];
    for (const id of domainIds) {
      const tt = TRACKER_TYPES.find(t => t.id === id);
      if (tt) {
        resolvedTrackerConfig = tt;
        resolvedTracker = trackers.find(t => t.type === id) ?? { id: '', type: id, goal: {}, entries: [] };
        break;
      }
    }
  }

  const tracker = resolvedTracker;
  const allEntries = tracker?.entries ?? [];
  const loggedToday = (allEntries || []).some(e => e.logged_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const currentGoal = tracker?.goal ?? {};
  const pct = node.progress;

  const trackerStreak = (() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if ((allEntries || []).some(e => e.logged_at.slice(0, 10) === key)) count++;
      else break;
    }
    return count;
  })();

  const bet = activeBets.find(b => b.goal_node_id === node.id);
  const betDaysLeft = bet ? Math.ceil((new Date(bet.deadline).getTime() - Date.now()) / 86400000) : null;

  const handleObjectiveSaved = async (type: string, goal: Record<string, any>) => {
    try {
      await api.patch(`/trackers/${type}/objective`, { goal });
      setTrackers(prev => prev.map(t => t.type === type ? { ...t, goal } : t));
      toast.success('Objective saved!');
    } catch { toast.error('Failed to save objective.'); }
  };

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
      <GlassCard sx={{
        p: 0, borderRadius: '22px', overflow: 'hidden', mb: 2,
        border: `1px solid ${loggedToday ? accentColor + '50' : accentColor + '20'}`,
        background: loggedToday
          ? `linear-gradient(160deg, ${accentColor}14 0%, ${domainColor}08 60%, rgba(13,14,26,0.92) 100%)`
          : `linear-gradient(160deg, ${accentColor}08 0%, rgba(13,14,26,0.95) 100%)`,
        boxShadow: loggedToday ? `0 8px 40px ${accentColor}20, 0 0 0 1px ${accentColor}18` : 'none',
      }}>
        <Box sx={{ height: 3, background: `linear-gradient(90deg, ${domainColor}00 0%, ${domainColor} 40%, ${accentColor} 70%, ${accentColor}00 100%)`, opacity: loggedToday ? 1 : 0.35 }} />
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{ width: 5, minHeight: 42, borderRadius: 3, background: `linear-gradient(to bottom, ${accentColor}, ${domainColor}77)`, flexShrink: 0, mt: 0.25 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                {config && (
                  <Box sx={{ width: 34, height: 34, borderRadius: '10px', flexShrink: 0, bgcolor: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${accentColor}30` }}>
                    <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{config.emoji}</Typography>
                  </Box>
                )}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', flex: 1 }} noWrap>{node.title}</Typography>
                {loggedToday && <Chip icon={<CheckIcon sx={{ fontSize: '10px !important' }} />} label="Logged" size="small" sx={{ height: 20, fontSize: '0.58rem', fontWeight: 700, bgcolor: '#10B98118', color: '#10B981' }} />}
                {trackerStreak > 1 && <Chip icon={<LocalFireDepartmentIcon sx={{ fontSize: '10px !important' }} />} label={`${trackerStreak}d`} size="small" sx={{ height: 20, fontSize: '0.58rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }} />}
              </Box>
              <Typography variant="caption" sx={{ color: domainColor, fontSize: '0.6rem', fontWeight: 700, opacity: 0.85, textTransform: 'uppercase' }}>{domain}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.75 }}>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <LinearProgress variant="determinate" value={pct} sx={{ height: 10, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { borderRadius: 5, background: `linear-gradient(90deg, ${domainColor}bb, ${accentColor})` } }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 900, color: accentColor, minWidth: 34, textAlign: 'right', fontSize: '0.88rem' }}>{pct}%</Typography>
          </Box>
          {bet && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, px: 1.25, py: 0.75, borderRadius: '10px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Typography variant="caption" sx={{ color: '#8B5CF6', fontWeight: 800, fontSize: '0.64rem' }}>🎰 {bet.stake_points} PP staked</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.6rem', ml: 0.5 }}>· {betDaysLeft !== null && betDaysLeft > 0 ? `${betDaysLeft}d left` : 'Due today'}</Typography>
            </Box>
          )}
        </Box>

        {config && (
          <Box sx={{ px: 2.5, pb: 2.5 }}>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
            <ObjectiveRow config={config} currentGoal={currentGoal} onSave={goal => handleObjectiveSaved(config.type, goal)} />
            <MiniChart entries={allEntries} chartKey={config.chartKey} color={accentColor} unit={config.chartUnit} />
          </Box>
        )}
      </GlassCard>

      {/* Inline editable tracker forms for all domain trackers */}
      {domainTrackers.map(dt => (
        <GlassCard key={dt.config.id} sx={{
          p: 2, borderRadius: '18px', mb: 2,
          border: `1px solid ${dt.config.color}30`,
          bgcolor: 'rgba(255,255,255,0.02)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontSize: '1.2rem' }}>{dt.config.icon}</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: dt.config.color }}>{dt.config.label}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {(dt.tracker.entries || []).filter(e => e.logged_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length} today
            </Typography>
          </Box>
          <EditableTrackerForm
            inline
            open
            onClose={() => {}}
            tracker={{ ...dt.tracker, def: dt.config, goal: dt.tracker.goal }}
            onSave={async (data) => {
              await api.post('/trackers/log', { type: dt.config.id, data });
              fetchTrackers();
            }}
            saving={false}
            accentColor={dt.config.color}
          />
        </GlassCard>
      ))}

      <GlassCard sx={{ mt: 2, p: 2 }}>
        <GoalActivityGraph goalId={node.id} goalName={node.title} domain={domain} userId={userId} />
      </GlassCard>
    </Box>
  );
};

export default NoteGoalDetail;
