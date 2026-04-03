import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Slider, Divider, CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  AccountBalanceWallet as WalletIcon,
  Timer as TimerIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import { useUser } from '../../hooks/useUser';
import { useUserPoints } from '../../hooks/useUserPoints';
import api from '../../lib/api';
import { toast } from 'react-hot-toast';

interface BetCommitDialogProps {
  open: boolean;
  onClose: () => void;
  challenge: {
    target: string;
    terms: string;
    deadline?: string;
    type?: string;
  };
  onSuccess?: (bet: any) => void;
}

const BetCommitDialog: React.FC<BetCommitDialogProps> = ({ open, onClose, challenge, onSuccess }) => {
  const { user } = useUser();
  const { points: userPoints, loading: pointsLoading, refresh: refreshPoints } = useUserPoints(user?.id);
  const [stake, setStake] = useState(50);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [createDuel, setCreateDuel] = useState(true);

  // Quick-stake presets (as % of available points, capped)
  const presets = useMemo(() => {
    if (!userPoints || userPoints <= 0) return [];
    const base = Math.min(500, Math.floor(userPoints * 0.5));
    if (base < 10) return [];
    return [
      { label: '25%', value: Math.max(10, Math.floor(base * 0.25)) },
      { label: '50%', value: Math.max(10, Math.floor(base * 0.5)) },
      { label: '75%', value: Math.max(10, Math.floor(base * 0.75)) },
      { label: 'MAX', value: base },
    ];
  }, [userPoints]);

  // Default deadline to today
  useEffect(() => {
    if (open) {
      const today = new Date();
      setDeadline(today.toISOString().split('T')[0]);
      refreshPoints();
    }
  }, [open, refreshPoints]);

  // Reset stake if it exceeds new max
  const maxStake = userPoints ? Math.min(500, Math.floor(userPoints * 0.5)) : 100;
  useEffect(() => {
    if (stake > maxStake) setStake(maxStake);
  }, [maxStake, stake]);

  const canAfford = userPoints !== null && stake <= userPoints && stake > 0;

  const handleCommit = async () => {
    if (!user?.id) { toast.error('Not authenticated'); return; }
    if (!deadline) { toast.error('Please set a deadline.'); return; }
    if (!canAfford) { toast.error(`Insufficient funds. You have ${userPoints ?? 0} PP.`); return; }

    setSaving(true);
    try {
      const finalDeadline = deadline.includes('T') ? deadline : `${deadline}T23:59:59Z`;

      const res = await api.post('/bets', {
        goalName: challenge.target,
        deadline: finalDeadline,
        stakePoints: stake,
        opponentType: createDuel ? 'duel' : 'self',
      });

      toast.success(`Commitment made! ${stake} PP pledged. 🎯`);

      // Post to community feed (best-effort)
      try {
        await api.post('/posts', {
          userName: user.name || 'A Praxis member',
          userAvatarUrl: user.avatar_url || null,
          content: `🎯 I just committed to an Axiom Challenge: "${challenge.target}" with ${stake} PP on the line. Accountability activated! 💪`,
          context: 'general',
          metadata: { betId: res.data.id },
        });
      } catch (e) { /* ignore feed failure */ }

      refreshPoints();
      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error('Bet commit error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to create bet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableRestoreFocus
      fullScreen={typeof window !== 'undefined' && window.innerWidth < 480}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: '20px' },
          bgcolor: 'rgba(30,30,40,0.98)',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(245,158,11,0.1)',
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <TrophyIcon sx={{ color: '#F59E0B' }} />
        Commit to Bet
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {/* Challenge terms */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {challenge.terms}
        </Typography>

        {/* Target box */}
        <Box sx={{ p: 2, bgcolor: 'rgba(245,158,11,0.05)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)', mb: 3 }}>
          <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900, display: 'block', mb: 0.5 }}>
            THE TARGET
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {challenge.target}
          </Typography>
        </Box>

        {/* Stake slider */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WalletIcon fontSize="small" color="primary" />
            Stake Amount (Praxis Points)
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {pointsLoading ? 'Loading...' : `Available: ${userPoints?.toLocaleString() ?? '...'} PP`}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {stake} PP
            </Typography>
          </Box>
          <Slider
            value={stake}
            onChange={(_, val) => setStake(val as number)}
            min={10}
            max={maxStake > 10 ? maxStake : 50}
            step={10}
            disabled={!canAfford}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v} PP`}
            sx={{
              color: 'primary.main',
              height: 8,
              '& .MuiSlider-thumb': {
                width: 24,
                height: 24,
                '&:hover': { boxShadow: '0 0 0 8px rgba(245,158,11,0.2)' },
              },
              '& .MuiSlider-track': { height: 8 },
              '& .MuiSlider-rail': { height: 8, opacity: 0.3 },
            }}
          />

          {/* Quick-stake presets */}
          {presets.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5, justifyContent: 'center' }}>
              {presets.map(p => (
                <Button
                  key={p.label}
                  size="small"
                  variant={stake === p.value ? 'contained' : 'outlined'}
                  onClick={() => setStake(p.value)}
                  sx={{
                    minWidth: 48,
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    px: 1.5,
                    py: 0.35,
                    bgcolor: stake === p.value ? 'rgba(245,158,11,0.2)' : 'transparent',
                    borderColor: 'rgba(245,158,11,0.3)',
                    color: '#F59E0B',
                    '&:hover': { bgcolor: 'rgba(245,158,11,0.15)' },
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </Box>
          )}

          {/* Zero points help */}
          {!canAfford && userPoints === 0 && (
            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(245,158,11,0.1)', borderRadius: 1, border: '1px solid rgba(245,158,11,0.3)' }}>
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <WarningIcon sx={{ fontSize: 14 }} /> Need Praxis Points?
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Earn PP by: Daily check-ins (+10), Completing goals (+50–200), Receiving honor from others
              </Typography>
            </Box>
          )}
          {!canAfford && userPoints !== 0 && (
            <Typography variant="caption" color="error">
              Insufficient funds. You have {userPoints} PP but selected {stake} PP.
            </Typography>
          )}
        </Box>

        {/* Deadline */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimerIcon fontSize="small" color="primary" />
            Deadline
          </Typography>
          <TextField
            fullWidth
            type="date"
            size="small"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
          />
        </Box>

        {/* Duel toggle */}
        <Box sx={{
          p: 2,
          bgcolor: createDuel ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.02)',
          borderRadius: 2,
          border: `1px solid ${createDuel ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
          mb: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                width: 24, height: 24,
                borderRadius: '6px',
                bgcolor: createDuel ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${createDuel ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{ fontSize: '0.8rem' }}>⚔️</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: createDuel ? '#A78BFA' : 'text.secondary', fontWeight: 700, display: 'block' }}>
                  Challenge a Friend
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                  {createDuel ? 'Auto-match with similar goals' : 'Solo commitment'}
                </Typography>
              </Box>
            </Box>
            <Button
              size="small"
              onClick={() => setCreateDuel(!createDuel)}
              sx={{
                bgcolor: createDuel ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.1)',
                color: createDuel ? '#A78BFA' : 'text.secondary',
                fontWeight: 700,
                fontSize: '0.7rem',
                px: 2,
                py: 0.5,
                border: `1px solid ${createDuel ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.2)'}`,
                '&:hover': {
                  bgcolor: createDuel ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.15)',
                },
              }}
            >
              {createDuel ? 'Duel ON' : 'Duel OFF'}
            </Button>
          </Box>
        </Box>

        {/* Risk/Reward summary */}
        <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Potential Reward (1.8x):</Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#10B981' }}>+{Math.round(stake * 1.8)} PP</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">Risk if missed:</Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#EF4444' }}>-{stake} PP</Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '10px' }}>Not Now</Button>
        <Button
          variant="contained"
          onClick={handleCommit}
          disabled={saving || !canAfford || !deadline}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <TrophyIcon />}
          sx={{
            borderRadius: '10px',
            fontWeight: 800,
            px: 3,
            background: 'linear-gradient(135deg, #F59E0B, #EF4444)'
          }}
        >
          {saving ? 'Placing...' : `Commit ${stake} PP`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BetCommitDialog;
