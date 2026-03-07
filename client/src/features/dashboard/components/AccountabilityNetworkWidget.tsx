import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import GlassCard from '../../../components/common/GlassCard';

interface FriendStatus {
  id: string;
  name: string;
  avatar_url: string | null;
  current_streak: number;
  last_activity_date: string | null;
}

function checkedInToday(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;
  return lastActivityDate.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function statusColor(lastActivityDate: string | null): string {
  if (!lastActivityDate) return '#6B7280';
  const daysSince = Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / 86400000);
  if (daysSince === 0) return '#10B981';
  if (daysSince === 1) return '#F59E0B';
  return '#EF4444';
}

function statusLabel(lastActivityDate: string | null): string {
  if (!lastActivityDate) return 'No activity yet';
  const daysSince = Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / 86400000);
  if (daysSince === 0) return 'Checked in today';
  if (daysSince === 1) return 'Checked in yesterday';
  return `Last seen ${daysSince}d ago`;
}

interface Props {
  userId: string;
}

const AccountabilityNetworkWidget: React.FC<Props> = ({ userId }) => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendStatus[]>([]);
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await axios.get(`${API_URL}/friends/of/${userId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const list: any[] = Array.isArray(res.data) ? res.data : [];
        // Batch-fetch profiles for all friends to get check-in data
        if (list.length === 0) return;
        const friendIds = list.map((f: any) => f.friend_id || f.id).filter(Boolean);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, current_streak, last_activity_date')
          .in('id', friendIds);
        if (profiles && profiles.length > 0) {
          // Sort: checked-in last (put them at end so "at risk" people show first)
          const sorted = [...profiles].sort((a, b) => {
            const aChecked = checkedInToday(a.last_activity_date) ? 1 : 0;
            const bChecked = checkedInToday(b.last_activity_date) ? 1 : 0;
            return aChecked - bChecked;
          });
          setFriends(sorted.slice(0, 8));
        }
      } catch {
        // silently ignore
      }
    };
    fetchFriends();
  }, [userId]);

  if (friends.length === 0) return null;

  const handleNudge = async (targetId: string, name: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await axios.post(`${API_URL}/notifications/nudge/${targetId}`, {}, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setNudgedIds(prev => new Set(Array.from(prev).concat(targetId)));
      toast.success(`Nudge sent to ${name}!`);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      toast.error(msg === 'Already nudged today.' ? 'Already nudged today.' : 'Failed to nudge.');
    }
  };

  const notCheckedIn = friends.filter(f => !checkedInToday(f.last_activity_date));
  const checkedIn = friends.filter(f => checkedInToday(f.last_activity_date));

  return (
    <Box sx={{ mt: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Accountability Network</Typography>
        {notCheckedIn.length > 0 && (
          <Chip
            label={`${notCheckedIn.length} haven't checked in`}
            size="small"
            sx={{ bgcolor: 'rgba(239,68,68,0.12)', color: '#EF4444', fontWeight: 700, fontSize: '0.72rem' }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {friends.map((friend) => {
          const isCheckedIn = checkedInToday(friend.last_activity_date);
          const dot = statusColor(friend.last_activity_date);
          const label = statusLabel(friend.last_activity_date);
          const canNudge = !isCheckedIn && !nudgedIds.has(friend.id);

          return (
            <GlassCard
              key={friend.id}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                borderRadius: '16px',
                minWidth: 200,
                flex: '1 1 200px',
                maxWidth: 260,
                border: isCheckedIn ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.15)',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: dot },
              }}
              onClick={() => navigate(`/profile/${friend.id}`)}
            >
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  src={friend.avatar_url || undefined}
                  sx={{ width: 44, height: 44, bgcolor: dot + '33' }}
                >
                  {(friend.name || 'U').charAt(0).toUpperCase()}
                </Avatar>
                {/* Status dot */}
                <Box sx={{
                  position: 'absolute', bottom: 1, right: 1,
                  width: 10, height: 10, borderRadius: '50%',
                  bgcolor: dot, border: '2px solid #0D0E1A',
                  boxShadow: isCheckedIn ? `0 0 6px ${dot}` : 'none',
                }} />
              </Box>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{friend.name}</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <LocalFireDepartmentIcon sx={{ fontSize: 12, color: '#F59E0B' }} />
                  <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 600 }}>
                    {friend.current_streak}d
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                    · {label}
                  </Typography>
                </Stack>
              </Box>
              {canNudge && (
                <Tooltip title="Nudge to check in">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleNudge(friend.id, friend.name); }}
                    sx={{ color: '#F59E0B', opacity: 0.8, '&:hover': { opacity: 1, color: '#FCD34D' } }}
                  >
                    <NotificationsActiveIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </GlassCard>
          );
        })}
      </Box>
    </Box>
  );
};

export default AccountabilityNetworkWidget;
