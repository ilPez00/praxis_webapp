import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

interface DayData {
  date: string;
  emoji: string;
  color: string;
  count: number;
  tooltip: string;
}

interface ActivityCalendarProps {
  userId: string;
  weeks?: number; // how many weeks to show (default 16 = ~4 months)
}

const WEEKDAYS = ['M', '', 'W', '', 'F', '', ''];

/** Build a grid of dates: rows = 7 (Mon-Sun), cols = N weeks */
function buildGrid(weeks: number): string[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - dayOfWeek - (weeks - 1) * 7);

  const grid: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + w * 7 + d);
      if (date <= today) {
        col.push(date.toISOString().slice(0, 10));
      } else {
        col.push('');
      }
    }
    grid.push(col);
  }
  return grid;
}

/** Pick which domain "won" the day based on activity counts */
function dominantDomain(
  trackerTypes: string[],
  goalDomains: string[],
  hasJournal: boolean,
  hasCheckin: boolean,
  hasAchievement: boolean,
  hasBet: boolean,
  hasEvent: boolean,
): { emoji: string; color: string; tooltip: string } {
  // Priority: achievement > goal domain > tracker domain > checkin > journal > bet > event
  if (hasAchievement) return { emoji: '🏆', color: '#F59E0B', tooltip: 'Goal achieved' };

  // Count domain occurrences from both trackers and goals
  const domainCounts: Record<string, number> = {};
  const TRACKER_DOMAIN: Record<string, string> = {
    lift: 'Fitness', cardio: 'Fitness', meal: 'Fitness', steps: 'Fitness', sleep: 'Mental Health',
    focus: 'Academics', read: 'Academics', meditate: 'Mental Health', journal: 'Mental Health',
    code: 'Career', apply: 'Career', network: 'Career',
    save: 'Investing / Financial Growth', invest: 'Investing / Financial Growth',
  };

  for (const t of trackerTypes) {
    const dom = TRACKER_DOMAIN[t] || 'Personal Goals';
    domainCounts[dom] = (domainCounts[dom] || 0) + 1;
  }
  for (const d of goalDomains) {
    domainCounts[d] = (domainCounts[d] || 0) + 2; // goals weigh more
  }

  // Find top domain
  let topDomain = '';
  let topCount = 0;
  for (const [dom, count] of Object.entries(domainCounts)) {
    if (count > topCount) { topDomain = dom; topCount = count; }
  }

  if (topDomain) {
    return {
      emoji: DOMAIN_ICONS[topDomain] || '🎯',
      color: DOMAIN_COLORS[topDomain] || '#A78BFA',
      tooltip: topDomain,
    };
  }

  if (hasCheckin) return { emoji: '✅', color: '#10B981', tooltip: 'Check-in' };
  if (hasJournal) return { emoji: '📓', color: '#8B5CF6', tooltip: 'Journal' };
  if (hasBet) return { emoji: '🎰', color: '#EF4444', tooltip: 'Bet placed' };
  if (hasEvent) return { emoji: '📅', color: '#06B6D4', tooltip: 'Event attended' };

  return { emoji: '·', color: '#333', tooltip: '' };
}

const ActivityCalendar: React.FC<ActivityCalendarProps> = ({ userId, weeks = 16 }) => {
  const [dayMap, setDayMap] = useState<Record<string, DayData>>({});
  const [loaded, setLoaded] = useState(false);

  const grid = useMemo(() => buildGrid(weeks), [weeks]);

  // Month labels from the grid
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < grid.length; w++) {
      const dateStr = grid[w][0]; // Monday of that week
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

      const results = await Promise.allSettled([
        // Tracker entries
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

        // Journal entries
        supabase
          .from('node_journal_entries').select('logged_at')
          .eq('user_id', userId).gte('logged_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.logged_at.slice(0, 10);
              ensure(d); map[d].journal = true; map[d].count++;
            }
          }),

        // Check-ins
        supabase
          .from('checkins').select('checked_in_at')
          .eq('user_id', userId).gte('checked_in_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.checked_in_at.slice(0, 10);
              ensure(d); map[d].checkin = true; map[d].count++;
            }
          }),

        // Achievements
        supabase
          .from('achievements').select('domain, created_at')
          .eq('user_id', userId).gte('created_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.created_at.slice(0, 10);
              ensure(d); map[d].achievement = true; map[d].count++;
            }
          }),

        // Bets
        supabase
          .from('bets').select('created_at')
          .eq('user_id', userId).gte('created_at', since)
          .then(({ data }) => {
            for (const e of data || []) {
              const d = e.created_at.slice(0, 10);
              ensure(d); map[d].bet = true; map[d].count++;
            }
          }),

        // Goal updates (from nodes updated_at)
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

        // Event RSVPs
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

      // Convert to DayData
      const result: Record<string, DayData> = {};
      for (const [date, info] of Object.entries(map)) {
        const dom = dominantDomain(
          info.trackerTypes, info.goalDomains,
          info.journal, info.checkin, info.achievement, info.bet, info.event,
        );
        result[date] = { date, emoji: dom.emoji, color: dom.color, count: info.count, tooltip: dom.tooltip };
      }
      setDayMap(result);
      setLoaded(true);
    };

    fetchAll();
  }, [userId, weeks]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const CELL = 15;
  const GAP = 2;

  return (
    <Box sx={{ px: { xs: 1, sm: 0 }, mb: 2, overflowX: 'auto' }}>
      <Box sx={{
        display: 'inline-flex', flexDirection: 'column',
        minWidth: 'fit-content',
      }}>
        {/* Month labels */}
        <Box sx={{ display: 'flex', ml: '18px', mb: '2px', height: 12 }}>
          {monthLabels.map((m, i) => (
            <Typography key={i} sx={{
              position: 'absolute',
              left: `${18 + m.col * (CELL + GAP)}px`,
              fontSize: '0.5rem', fontWeight: 700, color: 'text.disabled',
              lineHeight: 1,
            }}>
              {m.label}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: 'flex', position: 'relative' }}>
          {/* Weekday labels */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, mr: '4px', pt: '14px' }}>
            {WEEKDAYS.map((label, i) => (
              <Box key={i} sx={{ width: 12, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Typography sx={{ fontSize: '0.42rem', color: 'text.disabled', fontWeight: 600, lineHeight: 1 }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Grid */}
          <Box sx={{ display: 'flex', gap: `${GAP}px`, pt: '14px' }}>
            {grid.map((week, wi) => (
              <Box key={wi} sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                {week.map((dateStr, di) => {
                  if (!dateStr) {
                    return <Box key={di} sx={{ width: CELL, height: CELL }} />;
                  }
                  const day = dayMap[dateStr];
                  const isToday = dateStr === todayStr;
                  const hasActivity = !!day;

                  return (
                    <Box
                      key={di}
                      title={day ? `${dateStr}: ${day.tooltip} (${day.count} activities)` : dateStr}
                      sx={{
                        width: CELL, height: CELL,
                        borderRadius: '3px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: hasActivity ? '0.55rem' : '0',
                        lineHeight: 1,
                        background: hasActivity
                          ? `${day.color}18`
                          : 'rgba(255,255,255,0.025)',
                        border: '1px solid',
                        borderColor: isToday
                          ? 'rgba(167,139,250,0.5)'
                          : hasActivity
                            ? `${day.color}30`
                            : 'rgba(255,255,255,0.04)',
                        cursor: 'default',
                        transition: 'all 0.1s ease',
                        '&:hover': {
                          transform: hasActivity ? 'scale(1.4)' : 'none',
                          zIndex: hasActivity ? 10 : 0,
                          borderColor: hasActivity ? `${day.color}60` : 'rgba(255,255,255,0.08)',
                          background: hasActivity ? `${day.color}30` : 'rgba(255,255,255,0.04)',
                        },
                      }}
                    >
                      {hasActivity ? day.emoji : ''}
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
