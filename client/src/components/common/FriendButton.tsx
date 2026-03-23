import React, { useState, useEffect } from 'react';
import {
  Button,
  Box,
  CircularProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PeopleIcon from '@mui/icons-material/People';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface Props {
  targetUserId: string;
  targetName?: string;
  size?: 'small' | 'medium';
}

type FriendStatus = 'none' | 'pending' | 'accepted';

interface StatusData {
  status: FriendStatus;
  requestId?: string;
  iAmRequester?: boolean;
}

const FriendButton: React.FC<Props> = ({ targetUserId, targetName, size = 'small' }) => {
  const [statusData, setStatusData] = useState<StatusData>({ status: 'none' });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);


  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/friends/status/${targetUserId}`);
        setStatusData(res.data);
      } catch {
        setStatusData({ status: 'none' });
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, [targetUserId]);

  const handleSendRequest = async () => {
    setActing(true);
    try {
      const res = await api.post(`/friends/request/${targetUserId}`);
      setStatusData({ status: 'pending', requestId: res.data.id, iAmRequester: true });
      toast.success(`Friend request sent to ${targetName || 'user'}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request.');
    } finally {
      setActing(false);
    }
  };

  const handleAccept = async () => {
    if (!statusData.requestId) return;
    setActing(true);
    try {
      await api.post(`/friends/accept/${statusData.requestId}`);
      setStatusData({ status: 'accepted' });
      toast.success(`You are now friends with ${targetName || 'this user'}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to accept request.');
    } finally {
      setActing(false);
    }
  };

  const handleCancelOrReject = async () => {
    if (!statusData.requestId) return;
    setMenuAnchor(null);
    setActing(true);
    try {
      await api.delete(`/friends/requests/${statusData.requestId}`);
      setStatusData({ status: 'none' });
      toast.success(statusData.iAmRequester ? 'Friend request cancelled.' : 'Request declined.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  const handleUnfriend = async () => {
    setMenuAnchor(null);
    setActing(true);
    try {
      await api.delete(`/friends/${targetUserId}`);
      setStatusData({ status: 'none' });
      toast.success(`Removed ${targetName || 'user'} from friends.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to unfriend.');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <CircularProgress size={18} sx={{ mx: 1 }} />;
  }

  const { status, iAmRequester } = statusData;

  if (status === 'accepted') {
    return (
      <>
        <Button
          size={size}
          variant="outlined"
          startIcon={<PeopleIcon />}
          endIcon={<KeyboardArrowDownIcon />}
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          disabled={acting}
          sx={{
            borderColor: 'rgba(16,185,129,0.4)',
            color: '#10B981',
            '&:hover': { borderColor: '#10B981', bgcolor: 'rgba(16,185,129,0.08)' },
          }}
        >
          Friends
        </Button>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' } } }}
        >
          <MenuItem onClick={handleUnfriend} sx={{ color: 'error.main', fontSize: '0.875rem' }}>
            Unfriend
          </MenuItem>
        </Menu>
      </>
    );
  }

  if (status === 'pending' && iAmRequester) {
    return (
      <>
        <Button
          size={size}
          variant="outlined"
          endIcon={<KeyboardArrowDownIcon />}
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          disabled={acting}
          sx={{
            borderColor: 'rgba(255,255,255,0.2)',
            color: 'text.secondary',
          }}
        >
          Pending
        </Button>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px' } } }}
        >
          <MenuItem onClick={handleCancelOrReject} sx={{ color: 'error.main', fontSize: '0.875rem' }}>
            Cancel Request
          </MenuItem>
        </Menu>
      </>
    );
  }

  if (status === 'pending' && !iAmRequester) {
    return (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size={size}
          variant="contained"
          onClick={handleAccept}
          disabled={acting}
          sx={{
            bgcolor: '#10B981',
            '&:hover': { bgcolor: '#059669' },
            fontWeight: 700,
          }}
        >
          {acting ? <CircularProgress size={14} color="inherit" /> : 'Accept'}
        </Button>
        <Button
          size={size}
          variant="outlined"
          onClick={handleCancelOrReject}
          disabled={acting}
          sx={{
            borderColor: 'rgba(239,68,68,0.4)',
            color: '#EF4444',
            '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.08)' },
          }}
        >
          Decline
        </Button>
      </Box>
    );
  }

  // Default: none
  return (
    <Button
      size={size}
      variant="outlined"
      startIcon={acting ? <CircularProgress size={14} color="inherit" /> : <PersonAddIcon />}
      onClick={handleSendRequest}
      disabled={acting}
      sx={{
        borderColor: 'rgba(245,158,11,0.35)',
        color: 'primary.main',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(245,158,11,0.08)' },
      }}
    >
      Add Friend
    </Button>
  );
};

export default FriendButton;
