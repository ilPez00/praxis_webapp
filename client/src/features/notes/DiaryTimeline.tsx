import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

interface DiaryItem {
  id: string;
  type: 'tracker' | 'journal' | 'checkin' | 'bet' | 'achievement' | 'post' | 'goal' | 'verification' | 'match';
  timestamp: string;
  title: string;
  detail?: string;
  icon: string;
  color: string;
  meta?: Record<string, any>;
}

interface DiaryTimelineProps {
  userId: string;
  days?: number;
}

const TYPE_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  tracker:      { icon: '📊', color: '#F59E0B', label: 'Tracker' },
  journal:      { icon: '📓', color: '#8B5CF6', label: 'Journal' },
  checkin:      { icon: '✅', color: '#10B981', label: 'Check-in' },
  bet:          { icon: '🎰', color: '#EF4444', label: 'Bet' },
  achievement:  { icon: '🏆', color: '#F59E0B', label: 'Achievement' },
  post:         { icon: '📝', color: '#3B82F6', label: 'Post' },
  goal:         { icon: '🎯', color: '#A78BFA', label: 'Goal Update' },
  verification: { icon: '🔍', color: '#06B6D4', label: 'Verification' },
  match:        { icon: '🤝', color: '#EC4899', label: 'Match' },
};

function groupByDate(items: DiaryItem[]): Record<string, DiaryItem[]> {
  const groups: Record<string, DiaryItem[]> = {};
  for (const item of items) {
    const date = item.timestamp.slice(0, 10);
    (groups[date] ??= []).push(item);
  }
  return groups;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return ''; }
}

const DiaryTimeline: React.FC<DiaryTimelineProps> = ({ userId, days = 30 }) => {
  const [items, setItems] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const fetchAll = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        // 1. Tracker entries
        (async () => {
          const { data: trackers } = await supabase
            .from('trackers').select('id, type').eq('user_id', userId);
          if (!trackers?.length) return [];
          const ids = trackers.map(t => t.id);
          const typeMap = Object.fromEntries(trackers.map(t => [t.id, t.type]));
          const { data: entries } = await supabase
            .from('tracker_entries').select('id, tracker_id, data, logged_at')
            .in('tracker_id', ids).gte('logged_at', since).order('logged_at', { ascending: false }).limit(200);
          return (entries || []).map(e => {
            const tType = typeMap[e.tracker_id] || 'unknown';
            const d = e.data as Record<string, any>;
            let detail = '';
            if (tType === 'lift' && d.exercise) detail = `${d.exercise} ${d.sets}×${d.reps} @ ${d.weight}kg`;
            else if (tType === 'cardio' && d.activity) detail = `${d.activity} ${d.duration || ''}min`;
            else if (tType === 'meal' && d.food) detail = `${d.food} ${d.calories ? d.calories + 'kcal' : ''}`;
            else if (tType === 'steps') detail = `${d.steps || 0} steps`;
            else if (tType === 'sleep') detail = `${d.hours || 0}h sleep`;
            else detail = Object.values(d).filter(Boolean).join(', ');
            return {
              id: `tracker-${e.id}`, type: 'tracker' as const, timestamp: e.logged_at,
              title: `${tType.charAt(0).toUpperCase() + tType.slice(1)} logged`,
              detail, icon: '📊', color: '#F59E0B',
            };
          });
        })(),

        // 2. Journal entries
        supabase
          .from('node_journal_entries').select('id, node_id, note, mood, logged_at')
          .eq('user_id', userId).gte('logged_at', since).order('logged_at', { ascending: false }).limit(100)
          .then(({ data }) => (data || []).map(e => ({
            id: `journal-${e.id}`, type: 'journal' as const, timestamp: e.logged_at,
            title: e.mood ? `Journal: ${e.mood}` : 'Journal entry',
            detail: e.note?.slice(0, 120) || '', icon: '📓', color: '#8B5CF6',
          }))),

        // 3. Check-ins
        supabase
          .from('checkins').select('id, mood, win_of_the_day, checked_in_at, streak_day')
          .eq('user_id', userId).gte('checked_in_at', since).order('checked_in_at', { ascending: false }).limit(60)
          .then(({ data }) => (data || []).map(e => ({
            id: `checkin-${e.id}`, type: 'checkin' as const, timestamp: e.checked_in_at,
            title: `Day ${e.streak_day} check-in`,
            detail: e.win_of_the_day || (e.mood ? `Mood: ${e.mood}` : ''),
            icon: '✅', color: '#10B981',
          }))),

        // 4. Bets
        supabase
          .from('bets').select('id, goal_name, stake_points, status, created_at')
          .eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(50)
          .then(({ data }) => (data || []).map(e => ({
            id: `bet-${e.id}`, type: 'bet' as const, timestamp: e.created_at,
            title: `Bet ${e.status === 'won' ? 'won' : e.status === 'lost' ? 'lost' : 'placed'}: ${e.goal_name}`,
            detail: `${e.stake_points} PP at stake`,
            icon: e.status === 'won' ? '🎉' : e.status === 'lost' ? '💸' : '🎰',
            color: e.status === 'won' ? '#10B981' : e.status === 'lost' ? '#EF4444' : '#F59E0B',
          }))),

        // 5. Achievements
        supabase
          .from('achievements').select('id, title, domain, created_at')
          .eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => (data || []).map(e => ({
            id: `achieve-${e.id}`, type: 'achievement' as const, timestamp: e.created_at,
            title: `Goal completed: ${e.title}`,
            detail: e.domain || '',
            icon: DOMAIN_ICONS[e.domain] || '🏆',
            color: DOMAIN_COLORS[e.domain] || '#F59E0B',
          }))),

        // 6. Posts
        supabase
          .from('posts').select('id, title, content, created_at')
          .eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(50)
          .then(({ data }) => (data || []).map(e => ({
            id: `post-${e.id}`, type: 'post' as const, timestamp: e.created_at,
            title: e.title ? `Posted: ${e.title}` : 'Shared a post',
            detail: e.content?.slice(0, 100) || '', icon: '📝', color: '#3B82F6',
          }))),

        // 7. Verification requests (sent)
        supabase
          .from('completion_requests').select('id, goal_name, status, created_at')
          .eq('requester_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => (data || []).map(e => ({
            id: `verify-${e.id}`, type: 'verification' as const, timestamp: e.created_at,
            title: `Verification ${e.status === 'approved' ? 'approved' : e.status === 'rejected' ? 'rejected' : 'requested'}`,
            detail: e.goal_name || '',
            icon: e.status === 'approved' ? '✅' : e.status === 'rejected' ? '❌' : '🔍',
            color: e.status === 'approved' ? '#10B981' : e.status === 'rejected' ? '#EF4444' : '#06B6D4',
          }))),

        // 8. Goal tree updates (from nodes updated_at)
        supabase
          .from('goal_trees').select('nodes').eq('user_id', userId).single()
          .then(({ data }) => {
            if (!data?.nodes) return [];
            return (data.nodes as any[])
              .filter(n => n.updated_at && new Date(n.updated_at) >= new Date(since))
              .map(n => ({
                id: `goal-${n.id}`, type: 'goal' as const, timestamp: n.updated_at,
                title: `${n.name}: ${Math.round((n.progress || 0) * 100)}%`,
                detail: n.domain || '',
                icon: DOMAIN_ICONS[n.domain] || '🎯',
                color: DOMAIN_COLORS[n.domain] || '#A78BFA',
              }));
          }),

        // 9. Sparring matches
        supabase
          .from('sparring_partners').select('id, partner_id, created_at')
          .eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(20)
          .then(async ({ data }) => {
            if (!data?.length) return [];
            const partnerIds = data.map(s => s.partner_id);
            const { data: profiles } = await supabase
              .from('profiles').select('id, name').in('id', partnerIds);
            const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
            return data.map(s => ({
              id: `match-${s.id}`, type: 'match' as const, timestamp: s.created_at,
              title: `Matched with ${nameMap[s.partner_id] || 'a partner'}`,
              detail: '', icon: '🤝', color: '#EC4899',
            }));
          }),
      ]);

      const allItems: DiaryItem[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allItems.push(...r.value);
        }
      }
      allItems.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setItems(allItems);
      setLoading(false);
    };

    fetchAll();
  }, [userId, days]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={24} sx={{ color: '#A78BFA' }} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, opacity: 0.4 }}>
        <Typography sx={{ fontSize: '2rem', mb: 1 }}>📖</Typography>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>No activity yet</Typography>
        <Typography sx={{ fontSize: '0.7rem', mt: 0.5 }}>Start logging trackers, journaling, or checking in</Typography>
      </Box>
    );
  }

  const grouped = groupByDate(items);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <Box sx={{ p: 1.5, pb: 4 }}>
      {dates.map(date => (
        <Box key={date} sx={{ mb: 2 }}>
          {/* Date header */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, mb: 0.75,
            position: 'sticky', top: 0, zIndex: 2,
            bgcolor: 'background.default', py: 0.5,
          }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: '#A78BFA', boxShadow: '0 0 6px #A78BFA44',
            }} />
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: 800, color: '#A78BFA',
              letterSpacing: '0.03em', textTransform: 'uppercase',
            }}>
              {formatDate(date)}
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(167,139,250,0.12)' }} />
            <Typography sx={{ fontSize: '0.55rem', opacity: 0.3, fontWeight: 600 }}>
              {grouped[date].length} {grouped[date].length === 1 ? 'entry' : 'entries'}
            </Typography>
          </Box>

          {/* Timeline entries */}
          <Box sx={{ pl: '14px', position: 'relative' }}>
            {/* Vertical timeline line */}
            <Box sx={{
              position: 'absolute', left: '3px', top: 0,
              width: '2px', height: 'calc(100% - 8px)',
              background: 'linear-gradient(to bottom, rgba(167,139,250,0.2), rgba(167,139,250,0.04))',
              borderRadius: '1px',
            }} />

            {grouped[date].map((item, idx) => {
              const style = TYPE_STYLES[item.type] || TYPE_STYLES.goal;
              const isLastInDay = idx === grouped[date].length - 1;

              return (
                <Box key={item.id} sx={{ position: 'relative', pl: '16px', mb: isLastInDay ? 0 : '2px' }}>
                  {/* Horizontal connector */}
                  <Box sx={{
                    position: 'absolute', left: '-11px', top: '10px',
                    width: '12px', height: '2px',
                    background: `${item.color}30`, borderRadius: '1px',
                  }} />
                  {/* Dot */}
                  <Box sx={{
                    position: 'absolute', left: '-14px', top: '7px',
                    width: '5px', height: '5px', borderRadius: '50%',
                    bgcolor: `${item.color}55`,
                    border: `1.5px solid ${item.color}88`,
                  }} />

                  {/* Entry pill */}
                  <Box sx={{
                    p: '5px 10px', borderRadius: '12px', mb: '1px',
                    display: 'flex', alignItems: 'flex-start', gap: 0.75,
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: `${item.color}25`,
                    },
                  }}>
                    <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.4, flexShrink: 0 }}>
                      {item.icon}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography sx={{
                          fontSize: '0.68rem', fontWeight: 650, lineHeight: 1.3,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{
                          fontSize: '0.5rem', fontWeight: 600, color: `${item.color}99`,
                          ml: 'auto', flexShrink: 0,
                        }}>
                          {formatTime(item.timestamp)}
                        </Typography>
                      </Box>
                      {item.detail && (
                        <Typography sx={{
                          fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1.3,
                          mt: 0.25,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.detail}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default DiaryTimeline;
