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
  const [stake, setStake] = useState(100);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [userPoints, setUserPoints] = useState<number | null>(null);

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
      
      // Fetch user points
      if (user?.id) {
        api.get(`/users/${user.id}`).then(res => {
          setUserPoints(res.data.praxis_points ?? 0);
        }).catch(() => setUserPoints(0));
      }
    }
  }, [open, challenge, user]);

  const handleCommit = async () => {
    if (!user?.id) return;
    if (!deadline) {
      toast.error("Please set a deadline.");
      return;
    }

    setSaving(true);
    try {
      // If deadline is just a date string, set it to end of day
      const finalDeadline = deadline.includes('T') ? deadline : `${deadline}T23:59:59Z`;

      const res = await api.post('/bets', {
        userId: user.id,
        goalName: challenge.target,
        deadline: finalDeadline,
        stakePoints: stake,
        // Optional: link to a goal if we can find one with similar name?
        // For now, Axiom bets are standalone.
      });

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
      toast.error(err.response?.data?.message || "Failed to create bet.");
    } finally {
      setSaving(false);
    }
  };

  const maxStake = userPoints ? Math.min(500, Math.floor(userPoints * 0.5)) : 100;
  const canAfford = userPoints !== null && userPoints >= 50;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
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
            min={50}
            max={maxStake > 50 ? maxStake : 100}
            step={10}
            disabled={!canAfford}
            sx={{ color: 'primary.main' }}
          />
          {!canAfford && (
            <Typography variant="caption" color="error">
              You need at least 50 PP to place a bet.
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
