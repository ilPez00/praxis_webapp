import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  TextField,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { API_URL } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { Domain } from '../../../models/Domain';
import { DOMAIN_COLORS } from '../../../types/goal';

interface GoalNode {
  id: string;
  name: string;
  domain: string;
  progress: number;
}

interface DuelDialogProps {
  open: boolean;
  onClose: () => void;
  opponentId: string;
  opponentName: string;
}

const DuelDialog: React.FC<DuelDialogProps> = ({ open, onClose, opponentId, opponentName }) => {
  const [loading, setLoading] = useState(false);
  const [opponentGoals, setOpponentGoals] = useState<GoalNode[]>([]);
  const [myGoals, setMyGoals] = useState<GoalNode[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<GoalNode | null>(null);
  
  const [stake, setStake] = useState(50);
  const [days, setDays] = useState(7);
  const [customTitle, setEditTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myPoints, setMyPoints] = useState(0);

  useEffect(() => {
    if (open && opponentId) {
      fetchData();
    }
  }, [open, opponentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [oppRes, myRes, profRes] = await Promise.all([
        axios.get(`${API_URL}/goals/${opponentId}`),
        axios.get(`${API_URL}/goals/${user.id}`),
        supabase.from('profiles').select('praxis_points').eq('id', user.id).single(),
      ]);

      const oppGoals: GoalNode[] = oppRes.data.nodes || [];
      const mGoals: GoalNode[] = myRes.data.nodes || [];
      
      // Sort: shared domains first
      const myDomains = new Set(mGoals.map(g => g.domain));
      const sortedOppGoals = [...oppGoals].sort((a, b) => {
        const aShared = myDomains.has(a.domain) ? 1 : 0;
        const bShared = myDomains.has(b.domain) ? 1 : 0;
        return bShared - aShared;
      });

      setOpponentGoals(sortedOppGoals);
      setMyGoals(mGoals);
      setMyPoints(profRes.data?.praxis_points || 0);

      // Pre-select first shared goal if available
      const firstShared = sortedOppGoals.find(g => myDomains.has(g.domain));
      if (firstShared) {
        setSelectedGoal(firstShared);
      }
    } catch (err) {
      console.error('Failed to fetch duel data:', err);
      toast.error('Could not load goals for dueling.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDuel = async () => {
    if (!selectedGoal && !customTitle.trim()) {
      toast.error('Select a goal or enter a title.');
      return;
    }
    if (stake > myPoints) {
      toast.error('Insufficient Praxis Points.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/duels`, {
        opponentId,
        title: selectedGoal ? `Duel: ${selectedGoal.name}` : customTitle,
        category: selectedGoal?.domain || 'Personal Goals',
        stakePP: stake,
        deadlineDays: days,
        goalNodeId: selectedGoal?.id,
      }, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      toast.success('Challenge sent!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send challenge.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalFireDepartmentIcon sx={{ color: '#F59E0B' }} />
          Challenge {opponentName}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                1. Select a focus for the duel
              </Typography>
              
              {opponentGoals.length > 0 ? (
                <Box sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, maxHeight: 200, overflow: 'auto' }}>
                  <List dense>
                    {opponentGoals.map((goal) => {
                      const isShared = myGoals.some(mg => mg.domain === goal.domain);
                      const isSelected = selectedGoal?.id === goal.id;
                      return (
                        <ListItem key={goal.id} disablePadding>
                          <ListItemButton 
                            selected={isSelected}
                            onClick={() => { setSelectedGoal(goal); setEditTitle(''); }}
                          >
                            <ListItemText 
                              primary={goal.name}
                              secondary={
                                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <Chip 
                                    label={goal.domain} 
                                    size="small" 
                                    sx={{ 
                                      height: 18, fontSize: '0.65rem', 
                                      bgcolor: `${DOMAIN_COLORS[goal.domain]}15`, 
                                      color: DOMAIN_COLORS[goal.domain],
                                      fontWeight: 700,
                                      border: `1px solid ${DOMAIN_COLORS[goal.domain]}40`
                                    }} 
                                  />
                                  {isShared && (
                                    <Box component="span" sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 0.5, 
                                      bgcolor: 'rgba(16,185,129,0.1)', 
                                      px: 1, 
                                      borderRadius: 10,
                                      border: '1px solid rgba(16,185,129,0.2)'
                                    }}>
                                      <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 800, fontSize: '0.6rem' }}>
                                        ⭐ Shared Goal Interest
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No public goals found for this user.</Typography>
              )}

              <Divider sx={{ my: 2 }}>OR</Divider>

              <TextField
                fullWidth
                size="small"
                label="Custom Challenge Title"
                placeholder="e.g. Read 3 books this week"
                value={customTitle}
                onChange={(e) => { setEditTitle(e.target.value); setSelectedGoal(null); }}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                2. Set the stakes
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Stake (PP)"
                  type="number"
                  size="small"
                  value={stake}
                  onChange={(e) => setStake(Math.max(10, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 10, max: myPoints }}
                  sx={{ flex: 1 }}
                  helperText={`Your balance: ${myPoints} PP`}
                />
                <TextField
                  label="Duration (Days)"
                  type="number"
                  size="small"
                  value={days}
                  onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 1, max: 90 }}
                  sx={{ flex: 1 }}
                />
              </Stack>
            </Box>

            <Box sx={{ p: 2, bgcolor: 'rgba(245,158,11,0.05)', borderRadius: 2, border: '1px dashed rgba(245,158,11,0.2)' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Rules: Once {opponentName} accepts, the stakes are locked. Both participants must claim completion before the deadline. The platform takes a small fee (5%) from the winner's pot.
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleCreateDuel}
          disabled={submitting || loading || (!selectedGoal && !customTitle.trim())}
          startIcon={<EmojiEventsIcon />}
          sx={{ 
            borderRadius: '10px', 
            px: 3,
            background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
            '&:hover': { background: 'linear-gradient(135deg, #D97706, #DC2626)' }
          }}
        >
          {submitting ? 'Sending...' : 'Send Challenge'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DuelDialog;
