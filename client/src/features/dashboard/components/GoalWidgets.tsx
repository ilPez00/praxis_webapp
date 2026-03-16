import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Box, Typography, Button, TextField, Chip,
  Tooltip, IconButton, Stack, Collapse, Divider, LinearProgress,
  Popover, Slider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import VerifiedIcon from '@mui/icons-material/Verified';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FlagIcon from '@mui/icons-material/Flag';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import GlassCard from '../../../components/common/GlassCard';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import { DOMAIN_COLORS } from '../../../types/goal';
import { FieldConfig, ObjectiveField, WidgetConfig, findWidget } from './widgetConfigs';

// ── Shared types ───────────────────────────────────────────────────────────────

interface GoalNode { id: string; name: string; domain?: string; category?: string; progress?: number; parentId?: string }
interface TrackerEntry { tracker_id: string; data: Record<string, any>; logged_at: string }
interface Tracker { id: string; type: string; goal: Record<string, any>; entries: TrackerEntry[] }
interface ActiveBet { id: string; goal_node_id: string; stake_points: number; deadline: string }
interface ActiveChallenge { id: string; title: string; description?: string; domain?: string; end_date?: string }
interface Props {
  userId: string;
  allNodes: GoalNode[];
  activeBets?: ActiveBet[];
  activeChallenges?: ActiveChallenge[];
  onProgressUpdate?: (nodeId: string, newProgress: number) => void;
}


// ── Mini 7-day bar chart ───────────────────────────────────────────────────────

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
      {/* Bars */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 72 }}>
        {days.map((day, i) => {
          const barH = Math.max((day.total / max) * 58, day.logged ? 10 : 3);
          return (
            <Tooltip key={i} title={`${day.label}: ${day.total > 0 ? `${day.total} ${unit}` : day.logged ? 'Logged' : 'No entry'}`} placement="top">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <Box sx={{
                  width: '100%',
                  height: `${barH}px`,
                  borderRadius: '5px 5px 2px 2px',
                  background: day.logged
                    ? day.isToday
                      ? `linear-gradient(to bottom, ${color}, ${color}77)`
                      : `linear-gradient(to bottom, ${color}99, ${color}33)`
                    : 'rgba(255,255,255,0.05)',
                  transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: day.isToday && day.logged
                    ? `0 0 12px ${color}55, 0 2px 8px ${color}33`
                    : 'none',
                  position: 'relative',
                  overflow: 'visible',
                }}>
                  {/* Glowing cap at top of today's bar */}
                  {day.isToday && day.logged && (
                    <Box sx={{
                      position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: color,
                      boxShadow: `0 0 10px ${color}, 0 0 20px ${color}88`,
                    }} />
                  )}
                </Box>
                <Typography sx={{
                  fontSize: '0.5rem',
                  color: day.isToday ? 'text.primary' : 'text.disabled',
                  fontWeight: day.isToday ? 800 : 400,
                  lineHeight: 1,
                  letterSpacing: day.isToday ? '0.02em' : 0,
                }}>
                  {day.isToday ? 'Now' : day.label.slice(0, 1)}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
      {/* Activity dot strip */}
      <Box sx={{ display: 'flex', gap: '3px', mt: 1 }}>
        {days.map((day, i) => (
          <Box key={i} sx={{
            flex: 1, height: 3, borderRadius: 2,
            background: day.logged
              ? day.isToday ? color : `${color}77`
              : 'rgba(255,255,255,0.07)',
            transition: 'background 0.3s ease',
          }} />
        ))}
      </Box>
    </Box>
  );
}

// ── Objective display / edit inline ───────────────────────────────────────────

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
            <TextField
              key={o.key}
              size="small"
              label={o.label + (o.unit ? ` (${o.unit})` : '')}
              type={o.type}
              placeholder={o.placeholder}
              value={draft[o.key] ?? ''}
              onChange={e => setDraft(prev => ({ ...prev, [o.key]: e.target.value }))}
              sx={{ flex: '1 1 120px', '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.78rem' }, '& .MuiInputLabel-root': { fontSize: '0.74rem' } }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
          <IconButton size="small" onClick={() => setEditing(false)} sx={{ color: 'text.disabled' }}>
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
        config.objectives
          .filter(o => currentGoal[o.key])
          .map(o => (
            <Chip
              key={o.key}
              label={`${o.label}: ${currentGoal[o.key]}${o.unit ? ' ' + o.unit : ''}`}
              size="small"
              sx={{ height: 16, fontSize: '0.58rem', bgcolor: `${config.color}15`, color: config.color, border: `1px solid ${config.color}25` }}
            />
          ))
      ) : (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', fontStyle: 'italic' }}>
          No objectives set
        </Typography>
      )}
      <Tooltip title="Edit objectives">
        <IconButton size="small" onClick={startEdit} sx={{ color: 'text.disabled', '&:hover': { color: config.color }, ml: 'auto', width: 20, height: 20 }}>
          <EditIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Unified goal card — progress + tracker + commitment in one ─────────────────

function UnifiedGoalCard({ node, config, tracker, bet, userId, onLogged, onObjectiveSaved, onProgressUpdate }: {
  node: GoalNode;
  config: WidgetConfig | null;
  tracker?: Tracker;
  bet?: ActiveBet;
  userId: string;
  onLogged: () => void;
  onObjectiveSaved: (type: string, goal: Record<string, any>) => Promise<void>;
  onProgressUpdate: (nodeId: string, newProgress: number) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [sliderVal, setSliderVal] = useState(Math.round((node.progress ?? 0) * 100));
  const [progressSaving, setProgressSaving] = useState(false);

  const domainColor = (DOMAIN_COLORS as Record<string, string>)[node.domain ?? ''] ?? '#8B5CF6';
  const accentColor = config?.color ?? domainColor;
  const pct = Math.round((node.progress ?? 0) * 100);

  const todayKey = new Date().toISOString().slice(0, 10);
  const allEntries = tracker?.entries ?? [];
  const todayEntries = allEntries.filter(e => e.logged_at.slice(0, 10) === todayKey);
  const loggedToday = todayEntries.length > 0;
  const latestEntry = todayEntries[0];
  const currentGoal = tracker?.goal ?? {};
  const showForm = logOpen || !loggedToday;

  // Consecutive days logged (streak within this tracker)
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
      onLogged();
    } catch { toast.error('Failed to log. Try again.'); }
    finally { setSaving(false); }
  };

  const handleProgressSave = async () => {
    setProgressSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(
        `${API_URL}/goals/${userId}/node/${node.id}/progress`,
        { progress: sliderVal },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      onProgressUpdate(node.id, sliderVal / 100);
      toast.success(`Updated to ${sliderVal}%`);
      setAnchorEl(null);
    } catch { toast.error('Failed to update progress.'); }
    finally { setProgressSaving(false); }
  };

  const betDaysLeft = bet ? Math.ceil((new Date(bet.deadline).getTime() - Date.now()) / 86400000) : null;

  return (
    <GlassCard sx={{
      p: 0, borderRadius: '22px', overflow: 'hidden',
      border: `1px solid ${loggedToday ? accentColor + '50' : accentColor + '20'}`,
      background: loggedToday
        ? `linear-gradient(160deg, ${accentColor}14 0%, ${domainColor}08 60%, rgba(13,14,26,0.92) 100%)`
        : `linear-gradient(160deg, ${accentColor}08 0%, rgba(13,14,26,0.95) 100%)`,
      boxShadow: loggedToday ? `0 8px 40px ${accentColor}20, 0 0 0 1px ${accentColor}18` : 'none',
      transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
    }}>
      {/* ── Glowing top accent strip ── */}
      <Box sx={{
        height: 3,
        background: `linear-gradient(90deg, ${domainColor}00 0%, ${domainColor} 40%, ${accentColor} 70%, ${accentColor}00 100%)`,
        opacity: loggedToday ? 1 : 0.35,
        transition: 'opacity 0.3s ease',
      }} />

      {/* ── Goal header ── */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          {/* Domain color bar — gradient */}
          <Box sx={{
            width: 5, minHeight: 42, borderRadius: 3,
            background: `linear-gradient(to bottom, ${accentColor}, ${domainColor}77)`,
            flexShrink: 0, mt: 0.25,
            boxShadow: `0 0 10px ${accentColor}44`,
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
                {node.name}
              </Typography>
              {/* Today logged chip */}
              {loggedToday && (
                <Chip
                  icon={<CheckIcon sx={{ fontSize: '10px !important', color: '#10B981 !important' }} />}
                  label="Logged"
                  size="small"
                  sx={{
                    height: 20, fontSize: '0.58rem', fontWeight: 700, flexShrink: 0,
                    bgcolor: '#10B98118', color: '#10B981', border: '1px solid #10B98133',
                    '& .MuiChip-icon': { ml: 0.5 },
                  }}
                />
              )}
              {/* Tracker streak badge */}
              {trackerStreak > 1 && (
                <Chip
                  icon={<LocalFireDepartmentIcon sx={{ fontSize: '10px !important', color: '#F59E0B !important' }} />}
                  label={`${trackerStreak}d`}
                  size="small"
                  sx={{
                    height: 20, fontSize: '0.58rem', fontWeight: 700, flexShrink: 0,
                    bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)',
                    '& .MuiChip-icon': { ml: 0.5 },
                  }}
                />
              )}
            </Box>
            {node.domain && (
              <Typography variant="caption" sx={{ color: domainColor, fontSize: '0.6rem', fontWeight: 700, opacity: 0.85, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {node.domain}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Progress bar + % */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.75 }}>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 10, borderRadius: 5,
                bgcolor: 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  background: `linear-gradient(90deg, ${domainColor}bb, ${accentColor})`,
                  boxShadow: pct > 0 ? `0 0 10px ${accentColor}66` : 'none',
                },
              }}
            />
            {/* Leading edge glow dot */}
            {pct > 2 && pct < 100 && (
              <Box sx={{
                position: 'absolute', top: '50%', left: `${pct}%`,
                transform: 'translate(-50%, -50%)',
                width: 10, height: 10, borderRadius: '50%',
                bgcolor: accentColor,
                boxShadow: `0 0 8px ${accentColor}, 0 0 16px ${accentColor}66`,
                pointerEvents: 'none',
              }} />
            )}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 900, color: accentColor, minWidth: 34, textAlign: 'right', fontSize: '0.88rem' }}>
            {pct}%
          </Typography>
          <Tooltip title="Update progress">
            <IconButton
              size="small"
              onClick={e => { setSliderVal(pct); setAnchorEl(e.currentTarget); }}
              sx={{ color: 'text.disabled', '&:hover': { color: accentColor, bgcolor: `${accentColor}12` }, width: 26, height: 26, borderRadius: '8px' }}
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Commitment badge (if staked) */}
        {bet && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25, px: 1.25, py: 0.75,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.06))',
            border: '1px solid rgba(139,92,246,0.22)',
          }}>
            <VerifiedIcon sx={{ fontSize: 13, color: '#8B5CF6' }} />
            <Typography variant="caption" sx={{ color: '#8B5CF6', fontWeight: 800, fontSize: '0.64rem' }}>
              {bet.stake_points} PP staked
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', ml: 0.5 }}>
              · {betDaysLeft !== null && betDaysLeft > 0 ? `${betDaysLeft}d left` : betDaysLeft === 0 ? 'Due today' : 'Deadline passed'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Progress edit popover */}
      <Popover
        open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2.5, minWidth: 280, borderRadius: '16px', bgcolor: '#1A1B2E', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' } } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Update: {node.name}</Typography>
        <Box sx={{ px: 1, mb: 1 }}>
          <Slider
            value={sliderVal} onChange={(_, v) => setSliderVal(v as number)}
            min={0} max={100} step={5} valueLabelDisplay="auto"
            valueLabelFormat={v => `${v}%`}
            sx={{ color: domainColor, '& .MuiSlider-thumb': { width: 20, height: 20 } }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          {[0, 25, 50, 75, 100].map(v => (
            <Button key={v} size="small" variant={sliderVal === v ? 'contained' : 'text'}
              onClick={() => setSliderVal(v)}
              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.7rem', borderRadius: '6px' }}>
              {v}%
            </Button>
          ))}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button fullWidth variant="outlined" size="small" onClick={() => setAnchorEl(null)} sx={{ borderRadius: '10px' }}>Cancel</Button>
          <Button fullWidth variant="contained" size="small" onClick={handleProgressSave} disabled={progressSaving} sx={{ borderRadius: '10px' }}>
            {progressSaving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Popover>

      {/* ── Tracker section (only if config exists) ── */}
      {config && (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

          {/* Today's logged data — prominent stat boxes */}
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
                      borderRadius: '14px',
                      border: `1px solid ${accentColor}28`,
                      boxShadow: `0 2px 12px ${accentColor}14, inset 0 1px 0 ${accentColor}10`,
                    }}>
                      <Typography sx={{
                        fontSize: f.type === 'text' ? '0.72rem' : '1.6rem',
                        fontWeight: 900, color: accentColor, lineHeight: 1, mb: 0.5,
                        wordBreak: 'break-word', letterSpacing: f.type === 'number' ? '-0.03em' : 0,
                      }}>
                        {String(val)}
                      </Typography>
                      <Typography variant="caption" sx={{
                        color: 'text.disabled', fontSize: '0.56rem', display: 'block',
                        lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {f.unit || f.label}
                      </Typography>
                    </Box>
                  );
                }).filter(Boolean)}
              </Box>
              {todayEntries.length > 1 && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', mt: 0.75, display: 'block' }}>
                  +{todayEntries.length - 1} more entr{todayEntries.length === 2 ? 'y' : 'ies'} today
                </Typography>
              )}
            </Box>
          )}

          {/* Objectives */}
          <ObjectiveRow config={config} currentGoal={currentGoal} onSave={goal => onObjectiveSaved(config.type, goal)} />

          {/* 7-day chart */}
          <MiniChart entries={allEntries} chartKey={config.chartKey} color={accentColor} unit={config.chartUnit} />

          {/* Log form */}
          <Collapse in={showForm}>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                <Typography variant="caption" sx={{
                  color: 'text.disabled', fontSize: '0.58rem', letterSpacing: '0.08em',
                  textTransform: 'uppercase', fontWeight: 700,
                }}>
                  {loggedToday ? 'Log another session' : "Log today's session"}
                </Typography>
                {loggedToday && (
                  <IconButton size="small" onClick={() => setLogOpen(v => !v)} sx={{ color: 'text.disabled', width: 22, height: 22, borderRadius: '6px', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
                    {logOpen ? <CloseIcon sx={{ fontSize: 12 }} /> : <AddIcon sx={{ fontSize: 12 }} />}
                  </IconButton>
                )}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.75 }}>
                {config.fields.map(f => (
                  <TextField
                    key={f.key}
                    size="small"
                    label={f.unit ? `${f.label} (${f.unit})` : f.label}
                    type={f.type}
                    placeholder={f.placeholder}
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
              <Button
                variant="contained"
                fullWidth
                onClick={handleLog}
                disabled={saving}
                endIcon={saving ? <CircularProgress size={13} color="inherit" /> : <AutoAwesomeIcon sx={{ fontSize: '15px !important' }} />}
                sx={{
                  borderRadius: '12px', fontWeight: 800, fontSize: '0.82rem', py: 1.25,
                  background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                  color: '#0A0B14',
                  boxShadow: `0 4px 20px ${accentColor}44`,
                  '&:hover': { boxShadow: `0 6px 28px ${accentColor}55`, transform: 'translateY(-1px)' },
                  '&:active': { transform: 'translateY(0)' },
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
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const GoalWidgets: React.FC<Props> = ({ userId, allNodes, activeBets = [], onProgressUpdate }) => {
  const navigate = useNavigate();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);

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

  // One card per root node (no parentId) — handle both camelCase and snake_case from backend
  const nodes = Array.isArray(allNodes) ? allNodes : [];
  const rootNodes = nodes.filter(n => {
    const pid = n.parentId || (n as any).parent_id;
    return !pid || pid === '' || pid === 'root' || pid === 'null';
  });
  const trackerMap = Object.fromEntries(trackers.map(t => [t.type, t]));
  const betByNodeId = Object.fromEntries(activeBets.map(b => [b.goal_node_id, b]));

  if (rootNodes.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TrendingUpIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="body1" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Your Goals
        </Typography>
        <Tooltip title="Open goal tree">
          <IconButton size="small" onClick={() => navigate('/goal-tree')} sx={{ color: 'text.disabled', width: 22, height: 22 }}>
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Chip
          label={`${rootNodes.length} goal${rootNodes.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
          {rootNodes.map(node => {
            const config = findWidget(node);
            const tracker = config ? trackerMap[config.type] : undefined;
            const bet = betByNodeId[node.id];
            return (
              <UnifiedGoalCard
                key={node.id}
                node={node}
                config={config}
                tracker={tracker}
                bet={bet}
                userId={userId}
                onLogged={fetchTrackers}
                onObjectiveSaved={handleObjectiveSaved}
                onProgressUpdate={onProgressUpdate ?? (() => {})}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default GoalWidgets;
export { UnifiedGoalCard, MiniChart, ObjectiveRow, findWidget, ALL_WIDGETS };
export type { WidgetConfig, Tracker, TrackerEntry, GoalNode as WidgetGoalNode, ActiveBet };
