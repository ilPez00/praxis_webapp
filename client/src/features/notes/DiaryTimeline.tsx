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
      try {
        const { data: entries } = await supabase
          .from('notebook_entries')
          .select('id, entry_type, title, content, mood, domain, occurred_at')
          .eq('user_id', userId)
          .gte('occurred_at', since)
          .order('occurred_at', { ascending: false })
          .limit(300);

        const diaryItems: DiaryItem[] = (entries || []).map(e => {
          const style = TYPE_STYLES[e.entry_type] || TYPE_STYLES.goal;
          let icon = e.mood || style.icon;
          if (e.entry_type === 'tracker') icon = '📊';
          
          return {
            id: e.id,
            type: e.entry_type as any,
            timestamp: e.occurred_at,
            title: e.title || 'Note',
            detail: e.content || '',
            icon,
            color: DOMAIN_COLORS[e.domain || ''] || style.color,
          };
        });
        setItems(diaryItems);
      } catch (err) {
        console.error('DiaryTimeline fetch error:', err);
      } finally {
        setLoading(false);
      }
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
