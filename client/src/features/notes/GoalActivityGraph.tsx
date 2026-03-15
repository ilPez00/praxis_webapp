import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography, CircularProgress, Chip, Avatar } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

/* ─── Activity event types ─────────────────────── */
interface ActivityEvent {
  id: string;
  type: 'tracker' | 'journal' | 'bet_placed' | 'bet_won' | 'bet_lost' | 'verification' | 'progress' | 'checkin' | 'event' | 'place';
  timestamp: string;
  label: string;
  detail?: string;
  icon: string;
  starred: boolean; // verifications + won bets
}

interface GoalActivityGraphProps {
  goalId: string;
  goalName: string;
  domain: string;
  userId: string;
  maxEvents?: number;
}

/* ─── SVG constants ─────────────────────────────── */
const LEFT_PAD = 56;    // room for date labels
const NODE_R = 7;
const STAR_R = 11;
const LINE_X = LEFT_PAD + 20;
const ROW_H = 56;
const CONTENT_X = LINE_X + 28;
const SVG_W = '100%';

const TYPE_COLORS: Record<string, string> = {
  tracker: '#F59E0B',
  journal: '#8B5CF6',
  bet_placed: '#EF4444',
  bet_won: '#10B981',
  bet_lost: '#EF4444',
  verification: '#06B6D4',
  progress: '#A78BFA',
  checkin: '#10B981',
  event: '#EC4899',
  place: '#3B82F6',
};

function formatShortDate(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 2) + (i * Math.PI / 5);
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${cx + rad * Math.cos(angle)},${cy - rad * Math.sin(angle)}`);
  }
  return `M${pts.join('L')}Z`;
}

/* ─── Component ─────────────────────────────────── */
const GoalActivityGraph: React.FC<GoalActivityGraphProps> = ({
  goalId, goalName, domain, userId, maxEvents = 50,
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const domainColor = DOMAIN_COLORS[domain] || '#A78BFA';
  const domainIcon = DOMAIN_ICONS[domain] || '🎯';

  useEffect(() => {
    if (!userId || !goalId) return;
    setLoading(true);

    const since = new Date(Date.now() - 90 * 86400000).toISOString(); // 90 days

    const fetchActivity = async () => {
      const all: ActivityEvent[] = [];

      // 1. Tracker entries linked to this goal's trackers
      try {
        const { data: trackers } = await supabase
          .from('trackers').select('id, type, node_id')
          .eq('user_id', userId).eq('node_id', goalId);
        if (trackers?.length) {
          const ids = trackers.map(t => t.id);
          const typeMap = Object.fromEntries(trackers.map(t => [t.id, t.type]));
          const { data: entries } = await supabase
            .from('tracker_entries').select('id, tracker_id, data, logged_at')
            .in('tracker_id', ids).gte('logged_at', since)
            .order('logged_at', { ascending: false }).limit(maxEvents);
          for (const e of entries || []) {
            const tType = typeMap[e.tracker_id] || 'log';
            const d = e.data as Record<string, any>;
            let detail = '';
            if (tType === 'lift' && d.exercise) detail = `${d.exercise} — ${d.sets}×${d.reps} @ ${d.weight}kg`;
            else if (tType === 'cardio') detail = `${d.activity || 'Cardio'} — ${d.duration || '?'}min`;
            else if (tType === 'meal') detail = `${d.food || 'Meal'} ${d.calories ? '· ' + d.calories + ' kcal' : ''}`;
            else if (tType === 'steps') detail = `${d.steps || 0} steps`;
            else detail = Object.values(d).filter(Boolean).slice(0, 3).join(' · ');
            all.push({
              id: `t-${e.id}`, type: 'tracker', timestamp: e.logged_at,
              label: `${tType.charAt(0).toUpperCase() + tType.slice(1)} logged`,
              detail, icon: '📊', starred: false,
            });
          }
        }
      } catch { /* table might not exist */ }

      // 2. Journal entries for this goal
      try {
        const { data: journals } = await supabase
          .from('node_journal_entries').select('id, note, mood, logged_at')
          .eq('user_id', userId).eq('node_id', goalId)
          .gte('logged_at', since)
          .order('logged_at', { ascending: false }).limit(maxEvents);
        for (const e of journals || []) {
          all.push({
            id: `j-${e.id}`, type: 'journal', timestamp: e.logged_at,
            label: e.mood ? `${e.mood} Journal` : 'Journal entry',
            detail: e.note?.slice(0, 120) || '', icon: e.mood || '📓', starred: false,
          });
        }
      } catch { /* */ }

      // 3. Bets on this goal
      try {
        const { data: bets } = await supabase
          .from('bets').select('id, stake_points, status, created_at')
          .eq('user_id', userId).eq('goal_node_id', goalId)
          .gte('created_at', since)
          .order('created_at', { ascending: false }).limit(maxEvents);
        for (const e of bets || []) {
          const isWon = e.status === 'won';
          const isLost = e.status === 'lost';
          all.push({
            id: `b-${e.id}`,
            type: isWon ? 'bet_won' : isLost ? 'bet_lost' : 'bet_placed',
            timestamp: e.created_at,
            label: isWon ? `Won bet! +${e.stake_points * 2} PP` : isLost ? `Lost bet: -${e.stake_points} PP` : `Staked ${e.stake_points} PP`,
            detail: isWon ? 'Goal verified, doubled stake' : isLost ? 'Bet expired' : 'Active wager',
            icon: isWon ? '🎉' : isLost ? '💸' : '🎰',
            starred: isWon, // ⭐ for won bets
          });
        }
      } catch { /* */ }

      // 4. Verification requests
      try {
        const { data: verifs } = await supabase
          .from('completion_requests').select('id, status, created_at')
          .eq('requester_id', userId).eq('goal_node_id', goalId)
          .gte('created_at', since)
          .order('created_at', { ascending: false }).limit(maxEvents);
        for (const e of verifs || []) {
          all.push({
            id: `v-${e.id}`, type: 'verification', timestamp: e.created_at,
            label: e.status === 'approved' ? 'Peer verified!' : e.status === 'rejected' ? 'Verification rejected' : 'Awaiting verification',
            detail: e.status === 'approved' ? 'Confirmed by peer' : '',
            icon: e.status === 'approved' ? '✅' : e.status === 'rejected' ? '❌' : '🔍',
            starred: e.status === 'approved', // ⭐ for verified
          });
        }
      } catch { /* */ }

      // 5. Check-ins (if the check-in references this goal)
      try {
        const { data: checkins } = await supabase
          .from('checkins').select('id, mood, win_of_the_day, checked_in_at, streak_day')
          .eq('user_id', userId).gte('checked_in_at', since)
          .order('checked_in_at', { ascending: false }).limit(30);
        // Check-ins don't have node_id — include recent ones as context
        for (const e of checkins || []) {
          all.push({
            id: `c-${e.id}`, type: 'checkin', timestamp: e.checked_in_at,
            label: `Day ${e.streak_day || '?'} check-in`,
            detail: e.win_of_the_day || '', icon: '✅', starred: false,
          });
        }
      } catch { /* */ }

      // Sort by time descending, limit
      all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setEvents(all.slice(0, maxEvents));
      setLoading(false);
    };

    fetchActivity();
  }, [userId, goalId, maxEvents]);

  // Group events by day for the branch-point markers
  const dayBoundaries = useMemo(() => {
    const seen = new Set<string>();
    const boundaries: number[] = [];
    events.forEach((ev, i) => {
      const day = ev.timestamp.slice(0, 10);
      if (!seen.has(day)) {
        seen.add(day);
        boundaries.push(i);
      }
    });
    return boundaries;
  }, [events]);

  const svgH = Math.max(events.length * ROW_H + 40, 120);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: domainColor }} />
      </Box>
    );
  }

  if (events.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
          No activity recorded yet for this goal.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1, pb: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1 }}>
        <Typography sx={{ fontSize: '1.1rem' }}>{domainIcon}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: domainColor }}>
          Activity Graph
        </Typography>
        <Chip
          label={`${events.length} events`}
          size="small"
          sx={{
            ml: 'auto', height: 22, fontSize: '0.65rem', fontWeight: 700,
            bgcolor: `${domainColor}20`, color: domainColor,
            border: `1px solid ${domainColor}30`,
          }}
        />
      </Box>

      {/* SVG Graph */}
      <Box sx={{
        bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden', position: 'relative',
      }}>
        <svg width={SVG_W} height={svgH} viewBox={`0 0 360 ${svgH}`} xmlns="http://www.w3.org/2000/svg">
          {/* Vertical trunk line */}
          <line
            x1={LINE_X} y1={20} x2={LINE_X} y2={svgH - 20}
            stroke={`${domainColor}40`} strokeWidth={2}
          />

          {events.map((ev, i) => {
            const y = 30 + i * ROW_H;
            const isStarred = ev.starred;
            const isDayStart = dayBoundaries.includes(i);
            const evColor = TYPE_COLORS[ev.type] || domainColor;

            return (
              <g key={ev.id}>
                {/* Day label on the left */}
                {isDayStart && (
                  <text
                    x={LEFT_PAD - 4} y={y + 4}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.5)"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                  >
                    {formatShortDate(ev.timestamp)}
                  </text>
                )}

                {/* Branch line from trunk to node */}
                <line
                  x1={LINE_X} y1={y} x2={LINE_X + (isStarred ? 16 : 10)} y2={y}
                  stroke={evColor} strokeWidth={1.5} opacity={0.6}
                />

                {/* Node: star for starred, circle for regular */}
                {isStarred ? (
                  <path
                    d={starPath(LINE_X + 16, y, STAR_R)}
                    fill={evColor}
                    stroke="#0A0B14"
                    strokeWidth={1}
                    opacity={0.95}
                  />
                ) : (
                  <circle
                    cx={LINE_X} cy={y} r={NODE_R}
                    fill={evColor}
                    stroke="#0A0B14"
                    strokeWidth={2}
                    opacity={0.9}
                  />
                )}

                {/* Event icon */}
                <text x={CONTENT_X} y={y + 1} fontSize="13" dominantBaseline="middle">
                  {ev.icon}
                </text>

                {/* Label */}
                <text
                  x={CONTENT_X + 20} y={y - 3}
                  fill={isStarred ? evColor : 'rgba(255,255,255,0.85)'}
                  fontSize="11"
                  fontWeight={isStarred ? '800' : '600'}
                  fontFamily="system-ui, sans-serif"
                >
                  {ev.label.length > 32 ? ev.label.slice(0, 30) + '…' : ev.label}
                </text>

                {/* Detail line */}
                {ev.detail && (
                  <text
                    x={CONTENT_X + 20} y={y + 12}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    fontFamily="system-ui, sans-serif"
                  >
                    {ev.detail.length > 42 ? ev.detail.slice(0, 40) + '…' : ev.detail}
                  </text>
                )}

                {/* Time (right side) */}
                {!isDayStart && (
                  <text
                    x={350} y={y + 4}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.3)"
                    fontSize="8"
                    fontFamily="system-ui, sans-serif"
                  >
                    {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </text>
                )}
              </g>
            );
          })}

          {/* Legend at bottom */}
          <g transform={`translate(${LEFT_PAD}, ${svgH - 12})`}>
            <circle cx={0} cy={0} r={4} fill="#F59E0B" />
            <text x={8} y={3} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="system-ui, sans-serif">log</text>
            <circle cx={35} cy={0} r={4} fill="#8B5CF6" />
            <text x={43} y={3} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="system-ui, sans-serif">journal</text>
            <circle cx={85} cy={0} r={4} fill="#EF4444" />
            <text x={93} y={3} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="system-ui, sans-serif">bet</text>
            <path d={starPath(130, 0, 7)} fill="#10B981" />
            <text x={140} y={3} fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="system-ui, sans-serif">★ verified/won</text>
          </g>
        </svg>
      </Box>
    </Box>
  );
};

export default GoalActivityGraph;
