import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, Box, Typography, TextField, Button, Chip,
  Slide, IconButton, CircularProgress, Slider,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

interface GoalNode {
  id: string;
  name: string;
  domain: string;
  progress: number;
  parentId?: string;
  status?: string;
}

const MOODS = [
  { emoji: '🔥', label: 'On fire' },
  { emoji: '💪', label: 'Strong' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😴', label: 'Tired' },
];

const SlideUp = React.forwardRef(function SlideUp(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface QuickLogDialogProps {
  open: boolean;
  onClose: () => void;
}

const QuickLogDialog: React.FC<QuickLogDialogProps> = ({ open, onClose }) => {
  const { user } = useUser();
  const [goals, setGoals] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<GoalNode | null>(null);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    setSelectedGoal(null);
    setNote('');
    setMood(null);

    supabase
      .from('goal_trees')
      .select('nodes')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.nodes && Array.isArray(data.nodes)) {
          const active = (data.nodes as GoalNode[]).filter(
            n => n.status !== 'suspended' && n.status !== 'completed'
          );
          setGoals(active);
        }
        setLoading(false);
      });
  }, [open, user?.id]);

  const handleSelectGoal = (goal: GoalNode) => {
    setSelectedGoal(goal);
    setProgress(Math.round((goal.progress || 0) * 100));
  };

  const handleSave = async () => {
    if (!user?.id || !selectedGoal) return;
    setSaving(true);

    try {
      // 1. Save journal entry
      if (note.trim() || mood) {
        await supabase.from('node_journal_entries').insert({
          user_id: user.id,
          node_id: selectedGoal.id,
          note: note.trim() || (mood ? `Mood: ${mood}` : ''),
          mood: mood,
          logged_at: new Date().toISOString(),
        });
      }

      // 2. Update progress if changed
      const currentProgress = Math.round((selectedGoal.progress || 0) * 100);
      if (progress !== currentProgress) {
        const { data: treeData } = await supabase
          .from('goal_trees')
          .select('nodes')
          .eq('user_id', user.id)
          .single();

        if (treeData?.nodes && Array.isArray(treeData.nodes)) {
          const updatedNodes = treeData.nodes.map((n: any) =>
            n.id === selectedGoal.id
              ? { ...n, progress: progress / 100, updated_at: new Date().toISOString() }
              : n
          );
          await supabase
            .from('goal_trees')
            .update({ nodes: updatedNodes })
            .eq('user_id', user.id);
        }
      }

      toast.success(`Logged on "${selectedGoal.name}"!`);
      onClose();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const domainColor = (domain: string) => DOMAIN_COLORS[domain] || '#A78BFA';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      TransitionComponent={SlideUp}
      PaperProps={{
        sx: {
          bgcolor: '#0F1117',
          borderRadius: '20px 20px 0 0',
          position: 'fixed',
          bottom: 0,
          m: 0,
          maxHeight: '85vh',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Handle bar */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.15)' }} />
        </Box>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
            {selectedGoal ? selectedGoal.name : 'Quick Log'}
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#A78BFA' }} />
          </Box>
        ) : !selectedGoal ? (
          /* ── Goal selector ─────────────────────── */
          <Box sx={{ px: 2.5, pb: 3 }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Select a goal to log progress
            </Typography>

            {goals.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', py: 4, textAlign: 'center' }}>
                No active goals yet. Create one in Notes first.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {goals.map(goal => {
                  const color = domainColor(goal.domain);
                  const icon = DOMAIN_ICONS[goal.domain] || '🎯';
                  const pct = Math.round((goal.progress || 0) * 100);
                  return (
                    <Box
                      key={goal.id}
                      onClick={() => handleSelectGoal(goal)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: '12px 14px', borderRadius: '14px',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        border: `1px solid rgba(255,255,255,0.06)`,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: `${color}12`, borderColor: `${color}30` },
                        '&:active': { transform: 'scale(0.98)' },
                      }}
                    >
                      <Typography sx={{ fontSize: '1.2rem' }}>{icon}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                          fontSize: '0.88rem', fontWeight: 700, color: '#F3F4F6',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {goal.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                          {goal.domain}
                        </Typography>
                      </Box>
                      {/* Progress ring */}
                      <Box sx={{ position: 'relative', width: 36, height: 36 }}>
                        <CircularProgress
                          variant="determinate"
                          value={100}
                          size={36}
                          thickness={3}
                          sx={{ color: 'rgba(255,255,255,0.06)', position: 'absolute' }}
                        />
                        <CircularProgress
                          variant="determinate"
                          value={pct}
                          size={36}
                          thickness={3}
                          sx={{ color, position: 'absolute' }}
                        />
                        <Typography sx={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.55rem', fontWeight: 800, color,
                        }}>
                          {pct}%
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        ) : (
          /* ── Log form ──────────────────────────── */
          <Box sx={{ px: 2.5, pb: 3 }}>
            {/* Back to goal list */}
            <Chip
              label="← Change goal"
              size="small"
              onClick={() => setSelectedGoal(null)}
              sx={{
                mb: 2, fontSize: '0.65rem', fontWeight: 700,
                bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            />

            {/* Progress slider */}
            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Progress
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: domainColor(selectedGoal.domain) }}>
                  {progress}%
                </Typography>
              </Box>
              <Slider
                value={progress}
                onChange={(_, v) => setProgress(v as number)}
                min={0} max={100} step={5}
                sx={{
                  color: domainColor(selectedGoal.domain),
                  height: 6,
                  '& .MuiSlider-thumb': { width: 18, height: 18 },
                }}
              />
            </Box>

            {/* Mood picker */}
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', mb: 1, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                How do you feel?
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {MOODS.map(m => (
                  <Chip
                    key={m.emoji}
                    label={`${m.emoji} ${m.label}`}
                    size="small"
                    onClick={() => setMood(mood === m.emoji ? null : m.emoji)}
                    sx={{
                      fontSize: '0.72rem', fontWeight: 600,
                      bgcolor: mood === m.emoji ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)',
                      color: mood === m.emoji ? '#A78BFA' : 'rgba(255,255,255,0.6)',
                      border: mood === m.emoji ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Note input */}
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              placeholder="What did you do? How's it going?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              sx={{
                mb: 2.5,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '14px',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  fontSize: '0.9rem',
                },
              }}
            />

            {/* Save button */}
            <Button
              fullWidth
              variant="contained"
              onClick={handleSave}
              disabled={saving || (!note.trim() && !mood && progress === Math.round((selectedGoal.progress || 0) * 100))}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
              sx={{
                borderRadius: '14px', fontWeight: 800, py: 1.5, fontSize: '0.9rem',
                background: `linear-gradient(135deg, ${domainColor(selectedGoal.domain)}, #F59E0B)`,
                '&:hover': { filter: 'brightness(1.1)' },
              }}
            >
              {saving ? 'Saving...' : 'Log Progress'}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuickLogDialog;
