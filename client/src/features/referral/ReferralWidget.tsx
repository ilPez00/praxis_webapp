/**
 * ReferralWidget — shows the user's referral code + stats.
 * Placed on the Dashboard. Each successful referral awards +100 PP to both parties.
 */
import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import GlassCard from '../../components/common/GlassCard';
import {
  Box, Typography, Button, TextField, InputAdornment, IconButton,
  Chip, Stack, CircularProgress, Divider, Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import toast from 'react-hot-toast';

const APP_URL = 'https://praxis-app.vercel.app'; // update to production URL

interface Props {
  userId: string;
}

const ReferralWidget: React.FC<Props> = ({ userId }) => {
  const [code, setCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimInput, setClaimInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const res = await api.get('/referrals/my-code');
        setCode(res.data.code);
        setReferralCount(res.data.referralCount ?? 0);
      } catch {
        // silently degrade
      } finally {
        setLoading(false);
      }
    };
    fetchCode();
  }, [userId]);

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => toast.success('Code copied!')).catch(() => {});
  };

  const shareInvite = () => {
    if (!code) return;
    const text = `Join me on Praxis — where serious people build serious goals. Use my code ${code} to get +100 bonus points when you sign up! → ${APP_URL}`;
    if (navigator.share) {
      navigator.share({ title: 'Join Praxis', text, url: APP_URL }).catch(() => {});
    } else {
      const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(twUrl, '_blank');
    }
  };

  const handleClaim = async () => {
    if (!claimInput.trim() || claiming) return;
    setClaiming(true);
    try {
      const res = await api.post('/referrals/claim', { code: claimInput.trim() });
      toast.success(res.data.message || '+100 PP awarded!');
      setClaimed(true);
      setClaimInput('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to claim code.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return null;

  return (
    <GlassCard sx={{ p: 3, borderRadius: '20px', border: '1px solid rgba(139,92,246,0.2)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <GroupAddIcon sx={{ color: '#8B5CF6' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            Invite Friends
          </Typography>
          <Typography variant="caption" color="text.secondary">
            You both get +100 PP when they join
          </Typography>
        </Box>
        {referralCount > 0 && (
          <Chip
            label={`${referralCount} joined`}
            size="small"
            sx={{ ml: 'auto', bgcolor: 'rgba(139,92,246,0.12)', color: '#8B5CF6', fontWeight: 700 }}
          />
        )}
      </Box>

      {/* Your code */}
      {code && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <TextField
            value={code}
            size="small"
            inputProps={{ readOnly: true, style: { fontWeight: 800, letterSpacing: '0.15em', fontSize: '1.1rem', textAlign: 'center' } }}
            sx={{
              flexGrow: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: 'rgba(139,92,246,0.08)',
                '& fieldset': { borderColor: 'rgba(139,92,246,0.3)' },
              },
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copy code">
                    <IconButton size="small" onClick={copyCode}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={shareInvite}
            startIcon={<ShareIcon />}
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            Share
          </Button>
        </Stack>
      )}

      <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* Claim a friend's code */}
      {claimed ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.7 }}>
          <CheckCircleIcon sx={{ color: '#10B981', fontSize: 18 }} />
          <Typography variant="body2" color="text.secondary">Referral code claimed — enjoy your bonus PP!</Typography>
        </Box>
      ) : (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Enter a friend's code…"
            value={claimInput}
            onChange={e => setClaimInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleClaim()}
            inputProps={{ maxLength: 8, style: { letterSpacing: '0.1em' } }}
            sx={{
              flexGrow: 1,
              '& .MuiOutlinedInput-root': { borderRadius: '12px' },
            }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={handleClaim}
            disabled={!claimInput.trim() || claiming}
            sx={{ borderRadius: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {claiming ? <CircularProgress size={16} /> : 'Claim'}
          </Button>
        </Stack>
      )}
    </GlassCard>
  );
};

export default ReferralWidget;
