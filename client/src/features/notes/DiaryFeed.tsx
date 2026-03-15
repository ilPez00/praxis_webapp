import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography, CircularProgress, Avatar, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SortIcon from '@mui/icons-material/Sort';
import FilterListIcon from '@mui/icons-material/FilterList';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';
import NoteEditDialog from './NoteEditDialog';

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
  goalId?: string;
  goalName?: string;
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

type SortMode = 'time' | 'goal' | 'emoji';

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

function groupByGoal(items: FeedItem[]): Record<string, FeedItem[]> {
  const groups: Record<string, FeedItem[]> = {};
  for (const item of items) {
    const key = item.goalName || 'Uncategorized';
    (groups[key] ??= []).push(item);
  }
  // Sort each group by time
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  return groups;
}

function groupByEmoji(items: FeedItem[]): Record<string, FeedItem[]> {
  const groups: Record<string, FeedItem[]> = {};
  for (const item of items) {
    const key = item.icon;
    (groups[key] ??= []).push(item);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
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

/** Safe query — returns [] on any error (missing table, bad column, etc.) */
async function safeQuery<T>(fn: () => Promise<{ data: T | null; error: any }>): Promise<T> {
  try {
    const { data, error } = await fn();
    if (error || !data) return [] as unknown as T;
    return data;
  } catch { return [] as unknown as T; }
}

/* ─── Component ─────────────────────────────────── */
const DiaryFeed: React.FC<DiaryFeedProps> = ({ userId, days = 30 }) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<FeedItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Sort / filter state
  const [sortMode, setSortMode] = useState<SortMode>('time');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [sortAnchor, setSortAnchor] = useState<null | HTMLElement>(null);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);

  const handleEditClick = (item: FeedItem, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  const handleItemUpdated = (updatedItem: FeedItem) => {
    setItems(prev => prev.map(item =>
      item.id === updatedItem.id ? updatedItem : item
    ));
  };

  useEffect(() => {
    if (!userId) return;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const fetchAll = async () => {
      setLoading(true);

      // Fetch goal nodes for name mapping
      const { data: treeData } = await supabase
        .from('goal_trees').select('nodes').eq('user_id', userId).single();
      const allNodes: any[] = treeData?.nodes && Array.isArray(treeData.nodes) ? treeData.nodes : [];
      const nodeNameMap: Record<string, string> = {};
      const nodeDomainMap: Record<string, string> = {};
      for (const n of allNodes) {
        nodeNameMap[n.id] = n.name || n.title || 'Goal';
        nodeDomainMap[n.id] = n.domain || '';
      }

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

        // 2. Journal entries (node_journal_entries → journal_entries fallback)
        (async () => {
          const entries = await safeQuery(() =>
            supabase.from('node_journal_entries').select('id, node_id, note, mood, logged_at')
              .eq('user_id', userId).gte('logged_at', since)
              .order('logged_at', { ascending: false }).limit(50)
          );
          if (Array.isArray(entries) && entries.length > 0) {
            return entries.map((e: any) => ({
              id: `j-${e.id}`, type: 'journal', timestamp: e.logged_at,
              title: e.mood ? `${e.mood} Journal` : 'Journal entry',
              detail: e.note?.slice(0, 200) || '', icon: e.mood || '📓', color: '#8B5CF6', badge: 'Journal',
              goalId: e.node_id || undefined,
              goalName: e.node_id ? (nodeNameMap[e.node_id] || undefined) : undefined,
            }));
          }
          // Fallback: legacy journal_entries table
          const legacy = await safeQuery(() =>
            supabase.from('journal_entries').select('id, note, mood, created_at')
              .eq('user_id', userId).gte('created_at', since)
              .order('created_at', { ascending: false }).limit(50)
          );
          return (Array.isArray(legacy) ? legacy : []).map((e: any) => ({
            id: `j-${e.id}`, type: 'journal', timestamp: e.created_at,
            title: e.mood ? `${e.mood} Journal` : 'Journal entry',
            detail: e.note?.slice(0, 200) || '', icon: e.mood || '📓', color: '#8B5CF6', badge: 'Journal',
          }));
        })(),

        // 3. Check-ins
        (async () => {
          const data = await safeQuery(() =>
            supabase.from('checkins').select('id, mood, win_of_the_day, checked_in_at, streak_day')
              .eq('user_id', userId).gte('checked_in_at', since)
              .order('checked_in_at', { ascending: false }).limit(30)
          );
          return (Array.isArray(data) ? data : []).map((e: any) => ({
            id: `c-${e.id}`, type: 'checkin', timestamp: e.checked_in_at,
            title: `Day ${e.streak_day || '?'} check-in${e.mood ? ' · ' + e.mood : ''}`,
            detail: e.win_of_the_day || '', icon: '✅', color: '#10B981', badge: 'Check-in',
          }));
        })(),

        // 4. Bets
        supabase
          .from('bets').select('id, goal_name, goal_node_id, stake_points, status, created_at')
          .eq('user_id', userId).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => (data || []).map(e => ({
            id: `b-${e.id}`, type: 'bet', timestamp: e.created_at,
            title: e.status === 'won' ? `Won bet: ${e.goal_name}` : e.status === 'lost' ? `Lost bet: ${e.goal_name}` : `Staked on: ${e.goal_name}`,
            detail: `${e.stake_points} PP ${e.status === 'won' ? '→ +' + e.stake_points * 2 + ' PP' : 'at stake'}`,
            icon: e.status === 'won' ? '🎉' : e.status === 'lost' ? '💸' : '🎰',
            color: e.status === 'won' ? '#10B981' : e.status === 'lost' ? '#EF4444' : '#F59E0B',
            badge: 'Bet',
            goalId: e.goal_node_id || undefined,
            goalName: e.goal_name || undefined,
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
            goalName: e.title || undefined,
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
          .from('completion_requests').select('id, goal_name, goal_node_id, status, created_at')
          .eq('requester_id', userId).gte('created_at', since)
          .order('created_at', { ascending: false }).limit(20)
          .then(({ data }) => (data || []).map(e => ({
            id: `v-${e.id}`, type: 'verification', timestamp: e.created_at,
            title: `${e.status === 'approved' ? 'Verified' : e.status === 'rejected' ? 'Rejected' : 'Pending'}: ${e.goal_name}`,
            detail: '', icon: e.status === 'approved' ? '✅' : e.status === 'rejected' ? '❌' : '🔍',
            color: e.status === 'approved' ? '#10B981' : e.status === 'rejected' ? '#EF4444' : '#06B6D4',
            badge: 'Verification',
            goalId: e.goal_node_id || undefined,
            goalName: e.goal_name || undefined,
          }))),

        // 8. Goal progress updates
        Promise.resolve(
          allNodes
            .filter(n => n.updated_at && n.updated_at >= since)
            .map(n => ({
              id: `g-${n.id}`, type: 'goal', timestamp: n.updated_at,
              title: `${n.name} → ${Math.round((n.progress || 0) * 100)}%`,
              detail: n.domain || '',
              icon: DOMAIN_ICONS[n.domain] || '🎯',
              color: DOMAIN_COLORS[n.domain] || '#A78BFA', badge: 'Goal',
              goalId: n.id,
              goalName: n.name || undefined,
            }))
        ),

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

          const dayPartner: Record<string, Record<string, number>> = {};
          for (const m of msgs) {
            const partner = m.sender_id === userId ? m.receiver_id : m.sender_id;
            if (!partner) continue;
            const day = m.timestamp.slice(0, 10);
            if (!dayPartner[day]) dayPartner[day] = {};
            dayPartner[day][partner] = (dayPartner[day][partner] || 0) + 1;
          }

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

  // Derived: filtered items
  const filtered = useMemo(() => {
    if (!filterType) return items;
    return items.filter(i => i.type === filterType);
  }, [items, filterType]);

  // Derived: unique types and goals for filter menu
  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.type));
    return Array.from(set).sort();
  }, [items]);

  const uniqueGoals = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.goalName) set.add(i.goalName); });
    return Array.from(set).sort();
  }, [items]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={22} sx={{ color: '#A78BFA' }} />
      </Box>
    );
  }

  if (items.length === 0) return null;

  // Group based on sort mode
  const renderGrouped = () => {
    if (sortMode === 'goal') {
      const grouped = groupByGoal(filtered);
      const keys = Object.keys(grouped).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
      });
      return keys.map(goalName => (
        <Box key={goalName} sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, px: 0.5 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#A78BFA', letterSpacing: '0.04em' }}>
              {goalName === 'Uncategorized' ? '📋 Uncategorized' : `🎯 ${goalName}`}
            </Typography>
            <Chip label={grouped[goalName].length} size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: 'rgba(167,139,250,0.12)', color: '#A78BFA' }} />
          </Box>
          {grouped[goalName].map(item => renderCard(item))}
        </Box>
      ));
    }

    if (sortMode === 'emoji') {
      const grouped = groupByEmoji(filtered);
      const keys = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);
      return keys.map(emoji => (
        <Box key={emoji} sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, px: 0.5 }}>
            <Typography sx={{ fontSize: '1rem' }}>{emoji}</Typography>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'text.disabled', letterSpacing: '0.04em' }}>
              {TYPE_META[grouped[emoji][0]?.type]?.badge || 'Items'}
            </Typography>
            <Chip label={grouped[emoji].length} size="small" sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }} />
          </Box>
          {grouped[emoji].map(item => renderCard(item))}
        </Box>
      ));
    }

    // Default: time
    const grouped = groupByDate(filtered);
    const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    return dates.map(date => (
      <Box key={date} sx={{ mb: 2 }}>
        <Typography sx={{
          fontSize: '0.6rem', fontWeight: 700, color: '#A78BFA',
          letterSpacing: '0.03em', mb: 0.75, px: 0.5,
          textTransform: 'uppercase',
        }}>
          {formatDateHeader(date)}
        </Typography>
        {grouped[date].map(item => renderCard(item))}
      </Box>
    ));
  };

  const renderCard = (item: FeedItem) => {
    const meta = TYPE_META[item.type] || { badge: item.type, color: '#888' };
    return (
      <Box key={item.id} sx={{
        mb: 1,
        p: '10px 12px',
        borderRadius: '14px',
        bgcolor: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.06)',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.08)',
          borderColor: `${item.color}30`,
        },
      }}>
        {/* Top row: icon + title + badge + time + edit */}
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
            {/* Show goal name when sorting by time */}
            {sortMode === 'time' && item.goalName && (
              <Typography sx={{ fontSize: '0.55rem', color: '#A78BFA', fontWeight: 600, mt: 0.15 }}>
                🎯 {item.goalName}
              </Typography>
            )}
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
          {(item.type === 'journal' || item.type === 'post' || item.type === 'goal') && (
            <IconButton
              size="small"
              onClick={(e) => handleEditClick(item, e)}
              sx={{
                ml: 0.5, width: 24, height: 24,
                color: 'text.secondary', opacity: 0,
                transition: 'opacity 0.15s ease',
                '.MuiBox-root:hover &': { opacity: 1 },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
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
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Section header with sort/filter */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', color: 'text.disabled', textTransform: 'uppercase' }}>
          Your Diary
        </Typography>
        <Chip
          label={filtered.length}
          size="small"
          sx={{ height: 16, fontSize: '0.5rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }}
        />
        <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />

        {/* Sort button */}
        <IconButton
          size="small"
          onClick={(e) => setSortAnchor(e.currentTarget)}
          sx={{
            width: 28, height: 28, borderRadius: '8px',
            bgcolor: sortMode !== 'time' ? 'rgba(167,139,250,0.12)' : 'transparent',
            color: sortMode !== 'time' ? '#A78BFA' : 'text.secondary',
          }}
        >
          <SortIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Menu
          anchorEl={sortAnchor}
          open={Boolean(sortAnchor)}
          onClose={() => setSortAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: '#1A1B2E', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', minWidth: 160 } } }}
        >
          {([['time', '🕐 By time'], ['goal', '🎯 By goal'], ['emoji', '😊 By emoji']] as [SortMode, string][]).map(([mode, label]) => (
            <MenuItem
              key={mode}
              selected={sortMode === mode}
              onClick={() => { setSortMode(mode); setSortAnchor(null); }}
              sx={{ fontSize: '0.8rem', fontWeight: sortMode === mode ? 800 : 400 }}
            >
              {label}
            </MenuItem>
          ))}
        </Menu>

        {/* Filter button */}
        <IconButton
          size="small"
          onClick={(e) => setFilterAnchor(e.currentTarget)}
          sx={{
            width: 28, height: 28, borderRadius: '8px',
            bgcolor: filterType ? 'rgba(245,158,11,0.12)' : 'transparent',
            color: filterType ? '#F59E0B' : 'text.secondary',
          }}
        >
          <FilterListIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Menu
          anchorEl={filterAnchor}
          open={Boolean(filterAnchor)}
          onClose={() => setFilterAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: '#1A1B2E', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', minWidth: 180, maxHeight: 320 } } }}
        >
          <MenuItem
            selected={!filterType}
            onClick={() => { setFilterType(null); setFilterAnchor(null); }}
            sx={{ fontSize: '0.8rem', fontWeight: !filterType ? 800 : 400 }}
          >
            All types
          </MenuItem>
          {uniqueTypes.map(type => {
            const meta = TYPE_META[type];
            return (
              <MenuItem
                key={type}
                selected={filterType === type}
                onClick={() => { setFilterType(type); setFilterAnchor(null); }}
                sx={{ fontSize: '0.8rem', fontWeight: filterType === type ? 800 : 400 }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta?.color || '#888', mr: 1.5, flexShrink: 0 }} />
                {meta?.badge || type}
              </MenuItem>
            );
          })}
        </Menu>
      </Box>

      {/* Active filter chips */}
      {(filterType || sortMode !== 'time') && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, px: 0.5, flexWrap: 'wrap' }}>
          {sortMode !== 'time' && (
            <Chip
              label={`Sorted: ${sortMode}`}
              size="small"
              onDelete={() => setSortMode('time')}
              sx={{ height: 22, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}
            />
          )}
          {filterType && (
            <Chip
              label={`Filter: ${TYPE_META[filterType]?.badge || filterType}`}
              size="small"
              onDelete={() => setFilterType(null)}
              sx={{ height: 22, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
            />
          )}
        </Box>
      )}

      {/* Grouped content */}
      {renderGrouped()}

      {/* Edit Dialog */}
      {editingItem && (
        <NoteEditDialog
          item={editingItem}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingItem(null);
          }}
          onUpdated={handleItemUpdated}
        />
      )}
    </Box>
  );
};

export default DiaryFeed;
