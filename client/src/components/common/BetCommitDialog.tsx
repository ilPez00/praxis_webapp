import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, Slider, Divider, CircularProgress, 
  InputAdornment 
} from '@mui/material';
import { 
  EmojiEvents as TrophyIcon, 
  AccountBalanceWallet as WalletIcon,
  Timer as TimerIcon
} from '@mui/icons-material';
import { useUser } from '../../hooks/useUser';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
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
  const [stake, setStake] = useState(50); // Lower default from 100 to 50
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [createDuel, setCreateDuel] = useState(true); // Default to creating duel

  // Default deadline to tonight 10pm if not provided
  useEffect(() => {
    if (open) {
      if (challenge.deadline) {
        // Try to parse relative deadlines like "today by 10pm"
        // For simplicity, we'll just use a date picker, but default to today
        const today = new Date();
        setDeadline(today.toISOString().split('T')[0]);
      } else {
        const today = new Date();
        setDeadline(today.toISOString().split('T')[0]);
      }

      // Fetch user points directly from Supabase
      const fetchUserPoints = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) return;

          const { data: profile, error } = await supabase
            .from('profiles')
            .select('praxis_points')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('[BetCommitDialog] Error fetching points:', error);
            setUserPoints(0);
          } else {
            const points = profile?.praxis_points ?? 0;
            console.log('[BetCommitDialog] User points:', points);
            setUserPoints(points);
          }
        } catch (err) {
          console.error('[BetCommitDialog] Fetch error:', err);
          setUserPoints(0);
        }
      };

      fetchUserPoints();
    }
  }, [open, challenge]);

  const handleCommit = async () => {
    if (!user?.id) {
      toast.error("Not authenticated");
      return;
    }
    if (!deadline) {
      toast.error("Please set a deadline.");
      return;
    }
    if (userPoints === null || stake > userPoints) {
      toast.error(`Insufficient funds. You have ${userPoints ?? 0} PP but need ${stake} PP.`);
      return;
    }

    console.log('[BetCommitDialog] Committing bet:', { 
      userId: user.id, 
      goalName: challenge.target, 
      deadline, 
      stake,
      opponentType: createDuel ? 'duel' : 'self'
    });
    setSaving(true);
    try {
      // If deadline is just a date string, set it to end of day
      const finalDeadline = deadline.includes('T') ? deadline : `${deadline}T23:59:59Z`;

      const res = await api.post('/bets', {
        userId: user.id,
        goalName: challenge.target,
        deadline: finalDeadline,
        stakePoints: stake,
        opponentType: createDuel ? 'duel' : 'self',
      });

      console.log('[BetCommitDialog] Bet created:', res.data);
      toast.success(`Commitment made! ${stake} PP pledged. 🎯`);

      // Post to community feed
      try {
        await api.post('/posts', {
          userId: user.id,
          userName: user.name || 'A Praxis member',
          userAvatarUrl: user.avatar_url || null,
          content: `🎯 I just committed to an Axiom Challenge: "${challenge.target}" with ${stake} PP on the line. Accountability activated! 💪`,
          context: 'general',
          metadata: { betId: res.data.id }
        });
      } catch (e) {
        console.error("Failed to post to feed", e);
      }

      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error('Bet commit error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to create bet.");
    } finally {
      setSaving(false);
    }
  };

  const maxStake = userPoints ? Math.min(500, Math.floor(userPoints * 0.5)) : 100;
  const canAfford = userPoints !== null && stake <= userPoints && stake <= maxStake;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth 
      disableRestoreFocus
      PaperProps={{ 
        sx: { 
          borderRadius: '20px',
          bgcolor: 'rgba(30,30,40,0.98)',
          border: '1px solid rgba(245,158,11,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(245,158,11,0.1)',
        } 
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrophyIcon sx={{ color: '#F59E0B' }} />
        Commit to Bet
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {challenge.terms}
        </Typography>

        <Box sx={{ p: 2, bgcolor: 'rgba(245,158,11,0.05)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)', mb: 3 }}>
          <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900, display: 'block', mb: 0.5 }}>
            THE TARGET
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {challenge.target}
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WalletIcon fontSize="small" color="primary" />
            Stake Amount (Praxis Points)
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Available: {userPoints?.toLocaleString() ?? '...'} PP
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
              {stake} PP
            </Typography>
          </Box>
          <Slider
            value={stake}
            onChange={(_, val) => setStake(val as number)}
            onChangeCommitted={(_, val) => setStake(val as number)}
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
          {!canAfford && userPoints === 0 && (
            <Box sx={{ mt: 1, p: 1.5, bgcolor: 'rgba(245,158,11,0.1)', borderRadius: 1, border: '1px solid rgba(245,158,11,0.3)' }}>
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'block', mb: 0.5 }}>
                💡 Need Praxis Points?
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Earn PP by: Daily check-ins (+10), Completing goals (+50-200), Verification claims (+25), or receiving honor from others
              </Typography>
            </Box>
          )}
          {!canAfford && userPoints !== 0 && (
            <Typography variant="caption" color="error">
              Insufficient funds. You have {userPoints} PP but selected {stake} PP.
            </Typography>
          )}
        </Box>

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

        {/* Duel Toggle */}
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
                  {createDuel ? 'Auto-match with someone who has similar goals' : 'Solo commitment'}
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
