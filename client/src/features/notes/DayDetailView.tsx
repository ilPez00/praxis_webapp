import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Chip, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';
import ContentRenderer from '../../components/common/ContentRenderer';

interface DayEntry {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  detail?: string;
  icon: string;
  color: string;
  goalDomain?: string;
}

interface DayDetailViewProps {
  userId: string;
  date: string;        // YYYY-MM-DD
  onClose: () => void;
}

const TYPE_BADGE: Record<string, { badge: string; color: string }> = {
  axiom:        { badge: 'Axiom', color: '#A78BFA' },
  tracker:      { badge: 'Tracked', color: '#F59E0B' },
  journal:      { badge: 'Journal', color: '#8B5CF6' },
  checkin:      { badge: 'Check-in', color: '#10B981' },
  bet:          { badge: 'Bet', color: '#EF4444' },
  achievement:  { badge: 'Achievement', color: '#F59E0B' },
  post:         { badge: 'Post', color: '#3B82F6' },
  goal:         { badge: 'Goal', color: '#A78BFA' },
  event:        { badge: 'Event', color: '#06B6D4' },
};

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Safe query */
async function safeQuery<T>(fn: () => PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  try {
    const { data, error } = await fn();
    if (error || !data) return [] as unknown as T;
    return data;
  } catch { return [] as unknown as T; }
}

/** Find the closest goal domain for an entry based on tracker type */
const TRACKER_DOMAIN: Record<string, string> = {
  lift: 'Fitness', cardio: 'Fitness', meal: 'Fitness', steps: 'Fitness',
  sleep: 'Mental Health', focus: 'Academics', read: 'Academics',
  meditate: 'Mental Health', journal: 'Mental Health',
  code: 'Career', apply: 'Career', network: 'Career',
  save: 'Investing / Financial Growth', invest: 'Investing / Financial Growth',
};

const DayDetailView: React.FC<DayDetailViewProps> = ({ userId, date, onClose }) => {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [axiomMessage, setAxiomMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !date) return;
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;

    const fetchDay = async () => {
      setLoading(true);
      const all: DayEntry[] = [];

      // Fetch Axiom brief for this date
      const { data: briefData } = await supabase
        .from('axiom_daily_briefs')
        .select('brief, generated_at')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

      if (briefData?.brief) {
        const brief = typeof briefData.brief === 'string' ? JSON.parse(briefData.brief) : briefData.brief;
        if (brief.message) {
          setAxiomMessage(brief.message);
          all.push({
            id: `axiom-${date}`,
            type: 'axiom',
            timestamp: briefData.generated_at || `${date}T06:00:00`,
            title: 'Axiom Daily Brief',
            detail: brief.message,
            icon: '🧠',
            color: '#A78BFA',
          });
        }

        // Include recap if present
        if (brief.recap) {
          all.push({
            id: `axiom-recap-${date}`,
            type: 'axiom',
            timestamp: briefData.generated_at || `${date}T22:00:00`,
            title: 'Daily Recap',
            detail: brief.recap,
            icon: '📋',
            color: '#A78BFA',
          });
        }
      }

      const results = await Promise.allSettled([
        // Tracker entries
        (async () => {
          const { data: trackers } = await supabase
            .from('trackers').select('id, type').eq('user_id', userId);
          if (!trackers?.length) return [];
          const ids = trackers.map(t => t.id);
          const typeMap = Object.fromEntries(trackers.map(t => [t.id, t.type]));
          const { data: entries } = await supabase
            .from('tracker_entries').select('id, tracker_id, data, logged_at')
            .in('tracker_id', ids)
            .gte('logged_at', dayStart).lte('logged_at', dayEnd)
            .order('logged_at', { ascending: true });
          return (entries || []).map(e => {
            const tType = typeMap[e.tracker_id] || 'log';
            const d = e.data as Record<string, any>;
            let detail = '';
            if (tType === 'lift' && d.exercise) detail = `${d.exercise} — ${d.sets}×${d.reps} @ ${d.weight}kg`;
            else if (tType === 'cardio') detail = `${d.activity || 'Cardio'} — ${d.duration || '?'}min`;
            else if (tType === 'meal') detail = `${d.food || 'Meal'} ${d.calories ? '· ' + d.calories + ' kcal' : ''}`;
            else if (tType === 'steps') detail = `${d.steps || 0} steps`;
            else if (tType === 'sleep') detail = `${d.hours || '?'}h sleep · quality ${d.quality || '?'}/5`;
            else detail = Object.values(d).filter(Boolean).slice(0, 3).join(' · ');
            return {
              id: `t-${e.id}`, type: 'tracker', timestamp: e.logged_at,
              title: `${tType.charAt(0).toUpperCase() + tType.slice(1)} entry`,
              detail, icon: '📊', color: '#F59E0B',
              goalDomain: TRACKER_DOMAIN[tType],
            };
          });
        })(),

        // Journal entries
        (async () => {
          const entries = await safeQuery(() =>
            supabase.from('node_journal_entries').select('id, node_id, note, mood, logged_at')
              .eq('user_id', userId).gte('logged_at', dayStart).lte('logged_at', dayEnd)
              .order('logged_at', { ascending: true })
          );
          return (Array.isArray(entries) ? entries : []).map((e: any) => ({
            id: `j-${e.id}`, type: 'journal', timestamp: e.logged_at,
            title: e.mood ? `${e.mood} Journal` : 'Journal entry',
            detail: e.note || '', icon: '📓', color: '#8B5CF6',
          }));
        })(),

        // Check-ins
        (async () => {
          const data = await safeQuery(() =>
            supabase.from('checkins').select('id, mood, win_of_the_day, checked_in_at, streak_day')
              .eq('user_id', userId).gte('checked_in_at', dayStart).lte('checked_in_at', dayEnd)
          );
          return (Array.isArray(data) ? data : []).map((e: any) => ({
            id: `c-${e.id}`, type: 'checkin', timestamp: e.checked_in_at,
            title: `Day ${e.streak_day || '?'} check-in${e.mood ? ' · ' + e.mood : ''}`,
            detail: e.win_of_the_day || '', icon: '✅', color: '#10B981',
          }));
        })(),

        // Bets
        supabase
          .from('bets').select('id, goal_name, stake_points, status, created_at')
          .eq('user_id', userId).gte('created_at', dayStart).lte('created_at', dayEnd)
          .then(({ data }) => (data || []).map(e => ({
            id: `b-${e.id}`, type: 'bet', timestamp: e.created_at,
            title: `Staked on: ${e.goal_name}`,
            detail: `${e.stake_points} PP`,
            icon: '🎰', color: '#EF4444',
          }))),

        // Achievements
        supabase
          .from('achievements').select('id, title, domain, created_at')
          .eq('user_id', userId).gte('created_at', dayStart).lte('created_at', dayEnd)
          .then(({ data }) => (data || []).map(e => ({
            id: `a-${e.id}`, type: 'achievement', timestamp: e.created_at,
            title: `Goal completed: ${e.title}`,
            detail: e.domain || '', icon: DOMAIN_ICONS[e.domain] || '🏆',
            color: DOMAIN_COLORS[e.domain] || '#F59E0B',
            goalDomain: e.domain,
          }))),

        // Posts
        supabase
          .from('posts').select('id, title, content, created_at')
          .eq('user_id', userId).gte('created_at', dayStart).lte('created_at', dayEnd)
          .then(({ data }) => (data || []).map(e => ({
            id: `p-${e.id}`, type: 'post', timestamp: e.created_at,
            title: e.title || 'Shared a post',
            detail: e.content?.slice(0, 200) || '', icon: '📝', color: '#3B82F6',
          }))),

        // Event RSVPs
        (async () => {
          const { data: rsvps } = await supabase
            .from('event_rsvps').select('id, event_id, status, created_at')
            .eq('user_id', userId).gte('created_at', dayStart).lte('created_at', dayEnd);
          if (!rsvps?.length) return [];
          const eventIds = rsvps.map(r => r.event_id);
          const { data: events } = await supabase
            .from('events').select('id, title').in('id', eventIds);
          const eventMap = Object.fromEntries((events || []).map(e => [e.id, e.title]));
          return rsvps.map(r => ({
            id: `e-${r.id}`, type: 'event', timestamp: r.created_at,
            title: `${r.status === 'going' ? 'Attending' : 'RSVP'}: ${eventMap[r.event_id] || 'Event'}`,
            detail: '', icon: '📅', color: '#06B6D4',
          }));
        })(),

        // Goal progress updates
        supabase
          .from('goal_trees').select('nodes').eq('user_id', userId).single()
          .then(({ data }) => {
            if (!data?.nodes) return [];
            return (data.nodes as any[])
              .filter(n => n.updated_at && n.updated_at.slice(0, 10) === date)
              .map(n => ({
                id: `g-${n.id}`, type: 'goal', timestamp: n.updated_at,
                title: `${n.name} → ${Math.round((n.progress || 0) * 100)}%`,
                detail: n.domain || '',
                icon: DOMAIN_ICONS[n.domain] || '🎯',
                color: DOMAIN_COLORS[n.domain] || '#A78BFA',
                goalDomain: n.domain,
              }));
          }),
      ]);

      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) all.push(...r.value);
      }

      // Sort chronologically
      all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      setEntries(all);
      setLoading(false);
    };

    fetchDay();
  }, [userId, date]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={22} sx={{ color: '#A78BFA' }} />
      </Box>
    );
  }

  return (
    <Box sx={{
      mt: 1, mb: 3, px: 1,
      borderRadius: '16px',
      bgcolor: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        p: 2, pb: 1,
      }}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#A78BFA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Day Detail
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 800, mt: 0.25 }}>
            {formatDateLabel(date)}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {entries.length === 0 ? (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            No activity recorded
          </Typography>
        </Box>
      ) : (
        <Box sx={{ p: 1, pt: 0 }}>
          {entries.map((entry, idx) => {
            const meta = TYPE_BADGE[entry.type] || { badge: entry.type, color: '#888' };
            // Color the left accent by related goal domain
            const accentColor = entry.goalDomain
              ? (DOMAIN_COLORS[entry.goalDomain] || entry.color)
              : entry.color;

            return (
              <Box key={entry.id} sx={{ display: 'flex', gap: 1.5, py: 1.25, px: 1 }}>
                {/* Timeline line + dot */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                  <Box sx={{
                    width: 10, height: 10, borderRadius: '50%',
                    bgcolor: `${accentColor}30`,
                    border: `2px solid ${accentColor}`,
                    flexShrink: 0,
                  }} />
                  {idx < entries.length - 1 && (
                    <Box sx={{
                      flex: 1, width: 2, mt: '2px',
                      background: `linear-gradient(to bottom, ${accentColor}30, transparent)`,
                    }} />
                  )}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0, pb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                    <Typography sx={{ fontSize: '0.85rem' }}>{entry.icon}</Typography>
                    <Typography sx={{
                      fontSize: '0.8rem', fontWeight: 700, color: '#F3F4F6',
                      flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {entry.title}
                    </Typography>
                    <Chip
                      label={meta.badge}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.5rem', fontWeight: 700,
                        bgcolor: `${meta.color}15`, color: `${meta.color}cc`,
                        border: `1px solid ${meta.color}25`,
                        '& .MuiChip-label': { px: '6px' },
                      }}
                    />
                    <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                      {formatTime(entry.timestamp)}
                    </Typography>
                  </Box>

                  {entry.detail && (
                    <ContentRenderer
                      content={entry.detail}
                      variant="comment"
                      sx={{
                        fontSize: '0.72rem',
                        color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.5,
                      }}
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default DayDetailView;
