import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Avatar, Chip } from '@mui/material';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

/* ─── Types ─────────────────────────────────────── */
interface FeedItem {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  detail?: string;
  icon: string;
  color: string;
  badge: string;
}

interface DiaryFeedProps {
  userId: string;
  days?: number;
}

const TYPE_META: Record<string, { badge: string; color: string }> = {
  tracker:      { badge: 'Tracked', color: '#F59E0B' },
  journal:      { badge: 'Journal', color: '#8B5CF6' },
  checkin:      { badge: 'Check-in', color: '#10B981' },
  bet:          { badge: 'Bet', color: '#EF4444' },
  achievement:  { badge: 'Achievement', color: '#F59E0B' },
  post:         { badge: 'Post', color: '#3B82F6' },
  goal:         { badge: 'Goal', color: '#A78BFA' },
  verification: { badge: 'Verification', color: '#06B6D4' },
  match:        { badge: 'Match', color: '#EC4899' },
  chat:         { badge: 'Conversation', color: '#F97316' },
  event:        { badge: 'Event', color: '#06B6D4' },
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(items: FeedItem[]): Record<string, FeedItem[]> {
  const groups: Record<string, FeedItem[]> = {};
  for (const item of items) {
    const d = item.timestamp.slice(0, 10);
    (groups[d] ??= []).push(item);
  }
  return groups;
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ─── Component ─────────────────────────────────── */
const DiaryFeed: React.FC<DiaryFeedProps> = ({ userId, days = 30 }) => {
  const [items, setItems] = useState<FeedItem[]>([]);
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
            .in('tracker_id', ids).gte('logged_at', since)
            .order('logged_at', { ascending: false }).limit(100);
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
              detail, icon: '📊', color: '#F59E0B', badge: 'Tracked',
            };
          });
        })(),

        // 2. Journal entries
        supabase
          .from('node_journal_entries').select('id, node_id, note, mood, logged_at')
          .eq('user_id', userId).gte('logged_at', since)
          .order('logged_at', { ascending: false }).limit(50)
          .then(({ data }) => (data || []).map(e => ({
            id: `j-${e.id}`, type: 'journal', timestamp: e.logged_at,
            title: e.mood ? `${e.mood} Journal` : 'Journal entry',
            detail: e.note?.slice(0, 200) || '', icon: '📓', color: '#8B5CF6', badge: 'Journal',
          }))),

        // 3. Check-ins
        supabase
          .from('checkins').select('id, mood, win_of_the_day, checked_in_at, streak_day')
          .eq('user_id', userId).gte('checked_in_at', since)
          .order('checked_in_at', { ascending: false }).limit(30)
          .then(({ data }) => (data || []).map(e => ({
            id: `c-${e.id}`, type: 'checkin', timestamp: e.checked_in_at,
            title: `Day ${e.streak_day} check-in${e.mood ? ' · ' + e.mood : ''}`,
            detail: e.win_of_the_day || '', icon: '✅', color: '#10B981', badge: 'Check-in',
          }))),

        // 4. Bets
        supabase
          .from('bets').select('id, goal_name, stake_points, status, created_at')
          .eq('user_id', userId).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => (data || []).map(e => ({
            id: `b-${e.id}`, type: 'bet', timestamp: e.created_at,
            title: e.status === 'won' ? `Won bet: ${e.goal_name}` : e.status === 'lost' ? `Lost bet: ${e.goal_name}` : `Staked on: ${e.goal_name}`,
            detail: `${e.stake_points} PP ${e.status === 'won' ? '→ +' + e.stake_points * 2 + ' PP' : 'at stake'}`,
            icon: e.status === 'won' ? '🎉' : e.status === 'lost' ? '💸' : '🎰',
            color: e.status === 'won' ? '#10B981' : e.status === 'lost' ? '#EF4444' : '#F59E0B',
            badge: 'Bet',
          }))),

        // 5. Achievements
        supabase
          .from('achievements').select('id, title, domain, created_at')
          .eq('user_id', userId).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(20)
          .then(({ data }) => (data || []).map(e => ({
            id: `a-${e.id}`, type: 'achievement', timestamp: e.created_at,
            title: `Goal completed: ${e.title}`,
            detail: e.domain || '', icon: DOMAIN_ICONS[e.domain] || '🏆',
            color: DOMAIN_COLORS[e.domain] || '#F59E0B', badge: 'Achievement',
          }))),

        // 6. Posts
        supabase
          .from('posts').select('id, title, content, created_at')
          .eq('user_id', userId).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => (data || []).map(e => ({
            id: `p-${e.id}`, type: 'post', timestamp: e.created_at,
            title: e.title || 'Shared a post',
            detail: e.content?.slice(0, 200) || '', icon: '📝', color: '#3B82F6', badge: 'Post',
          }))),

        // 7. Verification requests
        supabase
          .from('completion_requests').select('id, goal_name, status, created_at')
          .eq('requester_id', userId).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(20)
          .then(({ data }) => (data || []).map(e => ({
            id: `v-${e.id}`, type: 'verification', timestamp: e.created_at,
            title: `${e.status === 'approved' ? 'Verified' : e.status === 'rejected' ? 'Rejected' : 'Pending'}: ${e.goal_name}`,
            detail: '', icon: e.status === 'approved' ? '✅' : e.status === 'rejected' ? '❌' : '🔍',
            color: e.status === 'approved' ? '#10B981' : e.status === 'rejected' ? '#EF4444' : '#06B6D4',
            badge: 'Verification',
          }))),

        // 8. Goal progress updates
        supabase
          .from('goal_trees').select('nodes').eq('user_id', userId).single()
          .then(({ data }) => {
            if (!data?.nodes) return [];
            return (data.nodes as any[])
              .filter(n => n.updated_at && n.updated_at >= since)
              .map(n => ({
                id: `g-${n.id}`, type: 'goal', timestamp: n.updated_at,
                title: `${n.name} → ${Math.round((n.progress || 0) * 100)}%`,
                detail: n.domain || '',
                icon: DOMAIN_ICONS[n.domain] || '🎯',
                color: DOMAIN_COLORS[n.domain] || '#A78BFA', badge: 'Goal',
              }));
          }),

        // 9. Event RSVPs
        (async () => {
          const { data: rsvps } = await supabase
            .from('event_rsvps').select('id, event_id, status, created_at')
            .eq('user_id', userId).gte('created_at', since);
          if (!rsvps?.length) return [];
          const eventIds = rsvps.map(r => r.event_id);
          const { data: events } = await supabase
            .from('events').select('id, title').in('id', eventIds);
          const eventMap = Object.fromEntries((events || []).map(e => [e.id, e.title]));
          return rsvps.map(r => ({
            id: `e-${r.id}`, type: 'event', timestamp: r.created_at,
            title: `${r.status === 'going' ? 'Attending' : 'RSVP'}: ${eventMap[r.event_id] || 'Event'}`,
            detail: '', icon: '📅', color: '#06B6D4', badge: 'Event',
          }));
        })(),

        // 10. Consistent conversations (>20 messages/day with someone)
        (async () => {
          const { data: msgs } = await supabase
            .from('messages').select('sender_id, receiver_id, timestamp')
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .gte('timestamp', since);
          if (!msgs?.length) return [];

          // Group by day + partner
          const dayPartner: Record<string, Record<string, number>> = {};
          for (const m of msgs) {
            const partner = m.sender_id === userId ? m.receiver_id : m.sender_id;
            if (!partner) continue;
            const day = m.timestamp.slice(0, 10);
            if (!dayPartner[day]) dayPartner[day] = {};
            dayPartner[day][partner] = (dayPartner[day][partner] || 0) + 1;
          }

          // Find partners with >20 msgs in a day
          const chatItems: FeedItem[] = [];
          const partnerIds = new Set<string>();
          const convos: { day: string; partnerId: string; count: number }[] = [];

          for (const [day, partners] of Object.entries(dayPartner)) {
            for (const [pid, count] of Object.entries(partners)) {
              if (count >= 20) {
                convos.push({ day, partnerId: pid, count });
                partnerIds.add(pid);
              }
            }
          }

          if (convos.length === 0) return [];

          const { data: profiles } = await supabase
            .from('profiles').select('id, name, avatar_url')
            .in('id', Array.from(partnerIds));
          const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name || p.id.slice(0, 8)]));

          for (const c of convos) {
            chatItems.push({
              id: `chat-${c.day}-${c.partnerId}`,
              type: 'chat', timestamp: `${c.day}T23:59:00`,
              title: `Deep convo with ${nameMap[c.partnerId] || 'someone'}`,
              detail: `${c.count} messages exchanged`,
              icon: '💬', color: '#F97316', badge: 'Conversation',
            });
          }
          return chatItems;
        })(),
      ]);

      const all: FeedItem[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) all.push(...r.value);
      }
      all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setItems(all);
      setLoading(false);
    };

    fetchAll();
  }, [userId, days]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={22} sx={{ color: '#A78BFA' }} />
      </Box>
    );
  }

  if (items.length === 0) return null;

  const grouped = groupByDate(items);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <Box sx={{ mt: 2 }}>
      {/* Section header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', color: 'text.disabled', textTransform: 'uppercase' }}>
          Your Diary
        </Typography>
        <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
      </Box>

      {dates.map(date => (
        <Box key={date} sx={{ mb: 2 }}>
          {/* Date header */}
          <Typography sx={{
            fontSize: '0.6rem', fontWeight: 700, color: '#A78BFA',
            letterSpacing: '0.03em', mb: 0.75, px: 0.5,
            textTransform: 'uppercase',
          }}>
            {formatDateHeader(date)}
          </Typography>

          {/* Cards */}
          {grouped[date].map(item => {
            const meta = TYPE_META[item.type] || { badge: item.type, color: '#888' };
            return (
              <Box key={item.id} sx={{
                mb: 1,
                p: '10px 12px',
                borderRadius: '14px',
                bgcolor: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.04)',
                  borderColor: `${item.color}30`,
                },
              }}>
                {/* Top row: icon + title + badge + time */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: `${item.color}15`, fontSize: '0.85rem', flexShrink: 0,
                  }}>
                    {item.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: '0.75rem', fontWeight: 650, lineHeight: 1.3,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {item.title}
                    </Typography>
                  </Box>
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
                  <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', fontWeight: 600, flexShrink: 0 }}>
                    {relativeTime(item.timestamp)}
                  </Typography>
                </Box>

                {/* Detail text */}
                {item.detail && (
                  <Typography sx={{
                    fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1.4,
                    mt: 0.75, ml: '36px',
                    display: '-webkit-box', WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {item.detail}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

export default DiaryFeed;
