import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Stack, Alert, CircularProgress,
  Divider, Paper
} from '@mui/material';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import CampaignIcon from '@mui/icons-material/Campaign';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';

const SystemTab: React.FC = () => {
  const [globalMessage, setGlobalMessage] = useState('');
  const [messageId, setMessageId] = useState('');
  const [pointsDelta, setPointsDelta] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [grantingPoints, setGrantingPoints] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/config');
      const config = res.data;
      const msg = config.find((c: any) => c.key === 'global_login_message');
      const mid = config.find((c: any) => c.key === 'global_login_message_id');
      if (msg) setGlobalMessage(msg.value);
      if (mid) setMessageId(mid.value);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMessage = async () => {
    setSavingMessage(true);
    try {
      // 1. Update message
      await api.put('/admin/config/global_login_message', { value: globalMessage });

      // 2. Update message ID (current timestamp as simple ID)
      const newId = Date.now().toString();
      await api.put('/admin/config/global_login_message_id', { value: newId });

      setMessageId(newId);
      toast.success('Global message updated! Users who haven\'t seen it will see it on login.');
    } catch (err) {
      toast.error('Failed to update message.');
    } finally {
      setSavingMessage(false);
    }
  };

  const handleClearSeen = async () => {
    if (!window.confirm('This will force ALL users to see the current message again at next login. Proceed?')) return;
    setSavingMessage(true);
    try {
      await api.post('/admin/config/clear-seen-messages');
      toast.success('Seen status cleared for all users.');
    } catch (err) {
      toast.error('Failed to clear seen status.');
    } finally {
      setSavingMessage(false);
    }
  };

  const handleGrantPointsAll = async () => {
    if (!window.confirm(`Are you sure you want to grant ${pointsDelta} PP to ALL users?`)) return;
    setGrantingPoints(true);
    try {
      await api.post('/admin/users/grant-points-all', { delta: pointsDelta });
      toast.success(`Successfully granted ${pointsDelta} PP to all users!`);
    } catch (err) {
      toast.error('Failed to grant points to all users.');
    } finally {
      setGrantingPoints(false);
    }
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>;

  return (
    <Stack spacing={4}>
      {/* Global Message Section */}
      <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CampaignIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Global Login Message</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          This message will be displayed to users only once when they visit the dashboard. 
          Updating the message generates a new ID, triggering it for everyone again.
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Message Content"
            multiline
            rows={4}
            fullWidth
            value={globalMessage}
            onChange={(e) => setGlobalMessage(e.target.value)}
            placeholder="Welcome to the new version of Praxis!..."
            sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}
          />
          <Typography variant="caption" color="text.disabled">
            Current Message ID: {messageId || 'None'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleUpdateMessage}
              disabled={savingMessage}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              {savingMessage ? 'Updating...' : 'Update & Send to All'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleClearSeen}
              disabled={savingMessage}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Force Re-display Current
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* Bulk Points Section */}
      <Paper sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CardGiftcardIcon sx={{ color: '#F59E0B' }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Bulk Praxis Points</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Grant or deduct points from ALL users in the system. Use carefully!
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Amount (Delta)"
            type="number"
            value={pointsDelta}
            onChange={(e) => setPointsDelta(Number(e.target.value))}
            sx={{ width: 150, bgcolor: 'rgba(255,255,255,0.03)' }}
          />
          <Button
            variant="contained"
            color="warning"
            onClick={handleGrantPointsAll}
            disabled={grantingPoints}
            sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
          >
            {grantingPoints ? 'Processing...' : `Grant to All Users`}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default SystemTab;
