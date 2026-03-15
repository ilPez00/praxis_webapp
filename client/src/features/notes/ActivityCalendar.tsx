import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

interface DayData {
  date: string;
  emojis: string[];   // up to 3 activity emojis
  color: string;       // dominant color
  count: number;
  tooltip: string;
}

interface ActivityCalendarProps {
  userId: string;
  weeks?: number;
  selectedDate?: string | null;
  onDaySelect?: (date: string) => void;
}

const WEEKDAYS = ['M', '', 'W', '', 'F', '', ''];

function buildGrid(weeks: number): string[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - dayOfWeek - (weeks - 1) * 7);

  const grid: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + w * 7 + d);
      col.push(date <= today ? date.toISOString().slice(0, 10) : '');
    }
    grid.push(col);
  }
  return grid;
}

const TRACKER_DOMAIN: Record<string, string> = {
  lift: 'Fitness', cardio: 'Fitness', meal: 'Fitness', steps: 'Fitness',
  sleep: 'Mental Health', focus: 'Academics', read: 'Academics',
  meditate: 'Mental Health', journal: 'Mental Health',
  code: 'Career', apply: 'Career', network: 'Career',
  save: 'Investing / Financial Growth', invest: 'Investing / Financial Growth',
};

const TRACKER_EMOJI: Record<string, string> = {
  lift: '🏋️', cardio: '🏃', meal: '🍽️', steps: '👟',
  sleep: '😴', focus: '🎯', read: '📖', meditate: '🧘',
  code: '💻', apply: '📋', network: '🤝',
  save: '💰', invest: '📈',
};

/** Build multiple emojis + dominant color for a day */
function buildDayDisplay(
  trackerTypes: string[],
  goalDomains: string[],
  hasJournal: boolean,
  hasCheckin: boolean,
  hasAchievement: boolean,
  hasBet: boolean,
  hasEvent: boolean,
): { emojis: string[]; color: string; tooltip: string } {
  const emojis: string[] = [];
  const domainCounts: Record<string, number> = {};

  // Achievement is always first
  if (hasAchievement) emojis.push('🏆');

  // Tracker emojis (unique)
  const seenTrackers = new Set<string>();
  for (const t of trackerTypes) {
    if (!seenTrackers.has(t) && TRACKER_EMOJI[t]) {
      emojis.push(TRACKER_EMOJI[t]);
      seenTrackers.add(t);
    }
    const dom = TRACKER_DOMAIN[t] || 'Personal Goals';
    domainCounts[dom] = (domainCounts[dom] || 0) + 1;
  }

  // Goal domain emojis
  for (const d of goalDomains) {
    domainCounts[d] = (domainCounts[d] || 0) + 2;
    const icon = DOMAIN_ICONS[d];
    if (icon && !emojis.includes(icon)) emojis.push(icon);
  }

  if (hasCheckin && !emojis.includes('✅')) emojis.push('✅');
  if (hasJournal && !emojis.includes('📓')) emojis.push('📓');
  if (hasBet && !emojis.includes('🎰')) emojis.push('🎰');
  if (hasEvent && !emojis.includes('📅')) emojis.push('📅');

  // Find dominant color
  let topDomain = '';
  let topCount = 0;
  for (const [dom, count] of Object.entries(domainCounts)) {
    if (count > topCount) { topDomain = dom; topCount = count; }
  }

  let color = '#A78BFA';
  if (hasAchievement) color = '#F59E0B';
  else if (topDomain) color = DOMAIN_COLORS[topDomain] || '#A78BFA';
  else if (hasCheckin) color = '#10B981';
  else if (hasJournal) color = '#8B5CF6';
  else if (hasBet) color = '#EF4444';
  else if (hasEvent) color = '#06B6D4';

  // Build tooltip
  const parts: string[] = [];
  if (hasAchievement) parts.push('Achievement');
  if (topDomain) parts.push(topDomain);
  if (hasCheckin) parts.push('Check-in');
  if (hasJournal) parts.push('Journal');
  if (hasBet) parts.push('Bet');
  if (hasEvent) parts.push('Event');

  return { emojis: emojis.slice(0, 3), color, tooltip: parts.join(' · ') };
}

const ActivityCalendar: React.FC<ActivityCalendarProps> = ({
  userId, weeks = 16, selectedDate, onDaySelect,
}) => {
  const [dayMap, setDayMap] = useState<Record<string, DayData>>({});
  const [loaded, setLoaded] = useState(false);

  const grid = useMemo(() => buildGrid(weeks), [weeks]);

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < grid.length; w++) {
      const dateStr = grid[w][0];
      if (!dateStr) continue;
      const month = new Date(dateStr + 'T00:00:00').getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }),
          col: w,
        });
        lastMonth = month;
      }
    }
    return labels;
  }, [grid]);

  useEffect(() => {
    if (!userId) return;
    const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString();

    const fetchAll = async () => {
      const map: Record<string, {
        trackerTypes: string[]; goalDomains: string[];
        journal: boolean; checkin: boolean; achievement: boolean; bet: boolean; event: boolean;
        count: number;
      }> = {};

      const ensure = (date: string) => {
        if (!map[date]) map[date] = {
          trackerTypes: [], goalDomains: [], journal: false, checkin: false,
          achievement: false, bet: false, event: false, count: 0,
        };
      };

      await Promise.allSettled([
        (async () => {
          const { data: trackers } = await supabase
            .from('trackers').select('id, type').eq('user_id', userId);
          if (!trackers?.length) return;
          const ids = trackers.map(t => t.id);
          const typeMap = Object.fromEntries(trackers.map(t => [t.id, t.type]));
          const { data: entries } = await supabase
            .from('tracker_entries').select('tracker_id, logged_at')
            .in('tracker_id', ids).gte('logged_at', since);
          for (const e of entries || []) {
            const d = e.logged_at.slice(0, 10);
            ensure(d);
            map[d].trackerTypes.push(typeMap[e.tracker_id]);
            map[d].count++;
          }
        })(),

        supabase
          .from('node_journal_entries').select('logged_at')
          .eq('user_id', userId).gte('logged_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.logged_at.slice(0, 10);
              ensure(d); map[d].journal = true; map[d].count++;
            }
          }),

        supabase
          .from('checkins').select('checked_in_at')
          .eq('user_id', userId).gte('checked_in_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.checked_in_at.slice(0, 10);
              ensure(d); map[d].checkin = true; map[d].count++;
            }
          }),

        supabase
          .from('achievements').select('domain, created_at')
          .eq('user_id', userId).gte('created_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.created_at.slice(0, 10);
              ensure(d); map[d].achievement = true; map[d].count++;
            }
          }),

        supabase
          .from('bets').select('created_at')
          .eq('user_id', userId).gte('created_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.created_at.slice(0, 10);
              ensure(d); map[d].bet = true; map[d].count++;
            }
          }),

        supabase
          .from('goal_trees').select('nodes').eq('user_id', userId).single()
          .then(({ data }) => {
            if (!data?.nodes) return;
            for (const n of data.nodes as any[]) {
              if (n.updated_at && n.updated_at >= since) {
                const d = n.updated_at.slice(0, 10);
                ensure(d);
                if (n.domain) map[d].goalDomains.push(n.domain);
                map[d].count++;
              }
            }
          }),

        supabase
          .from('event_rsvps').select('event_id, created_at')
          .eq('user_id', userId)
          .then(({ data }) => {
            for (const e of data || []) {
              if (e.created_at && e.created_at >= since) {
                const d = e.created_at.slice(0, 10);
                ensure(d); map[d].event = true; map[d].count++;
              }
            }
          }),
      ]);

      const result: Record<string, DayData> = {};
      for (const [date, info] of Object.entries(map)) {
        const display = buildDayDisplay(
          info.trackerTypes, info.goalDomains,
          info.journal, info.checkin, info.achievement, info.bet, info.event,
        );
        result[date] = {
          date, emojis: display.emojis, color: display.color,
          count: info.count, tooltip: display.tooltip,
        };
      }
      setDayMap(result);
      setLoaded(true);
    };

    fetchAll();
  }, [userId, weeks]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const CELL = 28;
  const GAP = 2;

  return (
    <Box sx={{ px: { xs: 1, sm: 0 }, mb: 2, overflowX: 'auto' }}>
      <Box sx={{ display: 'inline-flex', flexDirection: 'column', minWidth: 'fit-content' }}>
        {/* Month labels */}
        <Box sx={{ display: 'flex', ml: '22px', mb: '3px', height: 14, position: 'relative' }}>
          {monthLabels.map((m, i) => (
            <Typography key={i} sx={{
              position: 'absolute',
              left: `${22 + m.col * (CELL + GAP)}px`,
              fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)',
              lineHeight: 1,
            }}>
              {m.label}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: 'flex', position: 'relative' }}>
          {/* Weekday labels */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, mr: '4px', pt: '16px' }}>
            {WEEKDAYS.map((label, i) => (
              <Box key={i} sx={{ width: 16, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Typography sx={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, lineHeight: 1 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Grid */}
          <Box sx={{ display: 'flex', gap: `${GAP}px`, pt: '16px' }}>
            {grid.map((week, wi) => (
              <Box key={wi} sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                {week.map((dateStr, di) => {
                  if (!dateStr) return <Box key={di} sx={{ width: CELL, height: CELL }} />;

                  const day = dayMap[dateStr];
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const hasActivity = !!day;
                  const clickable = !!onDaySelect && hasActivity;

                  return (
                    <Box
                      key={di}
                      onClick={() => clickable && onDaySelect!(dateStr)}
                      title={day ? `${dateStr}: ${day.tooltip} (${day.count})` : dateStr}
                      sx={{
                        width: CELL, height: CELL,
                        borderRadius: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '1px',
                        fontSize: '0.6rem',
                        lineHeight: 1,
                        background: isSelected
                          ? `${day?.color || '#A78BFA'}30`
                          : hasActivity
                            ? `${day.color}18`
                            : 'rgba(255,255,255,0.025)',
                        border: '1px solid',
                        borderColor: isSelected
                          ? `${day?.color || '#A78BFA'}70`
                          : isToday
                            ? 'rgba(167,139,250,0.5)'
                            : hasActivity
                              ? `${day.color}30`
                              : 'rgba(255,255,255,0.04)',
                        cursor: clickable ? 'pointer' : 'default',
                        transition: 'all 0.1s ease',
                        overflow: 'hidden',
                        '&:hover': clickable ? {
                          transform: 'scale(1.3)',
                          zIndex: 10,
                          borderColor: `${day?.color}70`,
                          background: `${day?.color}35`,
                        } : {
                          transform: hasActivity ? 'scale(1.2)' : 'none',
                          zIndex: hasActivity ? 10 : 0,
                        },
                      }}
                    >
                      {hasActivity && day.emojis.map((e, i) => (
                        <span key={i} style={{ fontSize: day.emojis.length > 2 ? '0.45rem' : day.emojis.length > 1 ? '0.5rem' : '0.65rem' }}>
                          {e}
                        </span>
                      ))}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ActivityCalendar;
