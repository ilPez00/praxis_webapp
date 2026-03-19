import React, { useEffect, useState, useCallback } from 'react';
import {
  Dialog, DialogContent, Box, Typography, TextField, Button, Chip,
  Slide, IconButton, CircularProgress, Divider,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';
import { DOMAIN_COLORS, DOMAIN_ICONS, GoalNode as FrontendGoalNode } from '../../types/goal';
import NoteGoalDetail from '../../features/notes/NoteGoalDetail';

interface RawGoalNode {
  id: string;
  name: string;
  domain: string;
  progress: number; // 0-1
  parentId?: string;
  status?: string;
  weight?: number;
  category?: string;
  children?: RawGoalNode[];
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

type ViewMode = 'selector' | 'goal' | 'free';

const QuickLogDialog: React.FC<QuickLogDialogProps> = ({ open, onClose }) => {
  const { user } = useUser();
  const [rawNodes, setRawNodes] = useState<RawGoalNode[]>([]);
  const [goals, setGoals] = useState<RawGoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<RawGoalNode | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('selector');
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeBets, setActiveBets] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    setSelectedGoal(null);
    setViewMode('selector');
    setNote('');
    setMood(null);

    // Fetch goals + bets in parallel
    Promise.all([
      supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active'),
    ]).then(([treeRes, betsRes]) => {
      if (treeRes.data?.nodes && Array.isArray(treeRes.data.nodes)) {
        const all = treeRes.data.nodes as RawGoalNode[];
        setRawNodes(all);
        setGoals(all.filter(n => n.status !== 'suspended' && n.status !== 'completed'));
      }
      setActiveBets(Array.isArray(betsRes.data) ? betsRes.data : []);
      setLoading(false);
    });
  }, [open, user?.id]);

  // Convert raw JSONB node → FrontendGoalNode shape for NoteGoalDetail
  const toFrontendNode = useCallback((raw: RawGoalNode): FrontendGoalNode => ({
    id: raw.id,
    title: raw.name,
    weight: raw.weight ?? 50,
    progress: Math.round((raw.progress || 0) * 100),
    parentId: raw.parentId,
    domain: raw.domain as any,
    status: raw.status as any,
    children: [],
  }), []);

  const handleProgressUpdate = useCallback((nodeId: string, newProgress: number) => {
    setRawNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, progress: newProgress / 100 } : n
    ));
    if (selectedGoal?.id === nodeId) {
      setSelectedGoal(prev => prev ? { ...prev, progress: newProgress / 100 } : prev);
    }
  }, [selectedGoal?.id]);

  const handleSelectGoal = (goal: RawGoalNode) => {
    setSelectedGoal(goal);
    setViewMode('goal');
  };

  const handleBack = () => {
    setSelectedGoal(null);
    setViewMode('selector');
    setNote('');
    setMood(null);
  };

  const handleSaveJournal = async () => {
    if (!user?.id) return;
    if (!note.trim() && !mood) { toast.error('Write a note or pick a mood.'); return; }
    setSaving(true);
    try {
      if (viewMode === 'goal' && selectedGoal) {
        // Goal-linked entry → node_journal_entries
        await supabase.from('node_journal_entries').insert({
          user_id: user.id,
          node_id: selectedGoal.id,
          note: note.trim() || (mood ? `Mood: ${mood}` : ''),
          mood: mood,
          logged_at: new Date().toISOString(),
        });
        toast.success(`Logged on "${selectedGoal.name}"!`);
      } else {
        // Free diary entry → journal_entries (uncategorized)
        await supabase.from('journal_entries').insert({
          user_id: user.id,
          note: note.trim() || (mood ? `Mood: ${mood}` : ''),
          mood: mood,
          created_at: new Date().toISOString(),
        });
        toast.success('Diary entry saved!');
      }
      setNote('');
      setMood(null);
      if (viewMode === 'free') onClose();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const domainColor = (domain: string) => DOMAIN_COLORS[domain] || '#A78BFA';

  const headerTitle = viewMode === 'goal' && selectedGoal
    ? selectedGoal.name
    : viewMode === 'free'
    ? 'Diary Entry'
    : 'Quick Log';

  // Shared journal form (mood + note + save)
  const renderJournalForm = (accentColor: string) => (
    <Box sx={{ px: 2.5, mt: viewMode === 'free' ? 0 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {viewMode === 'free' ? 'How are you feeling?' : 'Quick journal'}
        </Typography>
        {viewMode === 'goal' && selectedGoal && (
          <Chip
            label={selectedGoal.name}
            size="small"
            sx={{
              fontSize: '0.65rem', fontWeight: 700,
              bgcolor: `${accentColor}20`,
              color: accentColor,
              border: `1px solid ${accentColor}30`,
              height: 20,
            }}
          />
        )}
      </Box>

      {/* Mood picker */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
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

      {/* Note input */}
      <TextField
        fullWidth
        multiline
        minRows={viewMode === 'free' ? 3 : 2}
        maxRows={6}
        autoFocus={viewMode === 'free'}
        placeholder={viewMode === 'free' ? "What's on your mind today?" : "What did you do? How's it going?"}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        sx={{
          mb: 2,
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
        onClick={handleSaveJournal}
        disabled={saving || (!note.trim() && !mood)}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
        sx={{
          borderRadius: '14px', fontWeight: 800, py: 1.5, fontSize: '0.9rem',
          background: `linear-gradient(135deg, ${accentColor}, #F59E0B)`,
          '&:hover': { filter: 'brightness(1.1)' },
          '&:disabled': { opacity: 0.4 },
        }}
      >
        {saving ? 'Saving...' : viewMode === 'free' ? 'Save Diary Entry' : 'Save Journal Entry'}
      </Button>
    </Box>
  );

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
          maxHeight: '90vh',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          overflowY: 'auto',
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {viewMode !== 'selector' && (
              <Chip
                label="←"
                size="small"
                onClick={handleBack}
                sx={{
                  fontSize: '0.7rem', fontWeight: 800, minWidth: 28,
                  bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              />
            )}
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
              {headerTitle}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#A78BFA' }} />
          </Box>
        ) : viewMode === 'selector' ? (
          /* ── Goal selector + free entry ──────── */
          <Box sx={{ px: 2.5, pb: 3 }}>
            {/* Free diary entry option */}
            <Box
              onClick={() => setViewMode('free')}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                p: '12px 14px', borderRadius: '14px', mb: 1.5,
                bgcolor: 'rgba(167,139,250,0.06)',
                border: '1px solid rgba(167,139,250,0.15)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.3)' },
                '&:active': { transform: 'scale(0.98)' },
              }}
            >
              <MenuBookIcon sx={{ fontSize: '1.3rem', color: '#A78BFA' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#F3F4F6' }}>
                  Free diary entry
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                  Write without linking to a goal
                </Typography>
              </Box>
              <Chip
                label="📝"
                size="small"
                sx={{
                  height: 28, fontSize: '0.85rem',
                  bgcolor: 'rgba(167,139,250,0.1)',
                  border: '1px solid rgba(167,139,250,0.2)',
                }}
              />
            </Box>

            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Or select a goal to log progress
            </Typography>

            {goals.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', py: 2, textAlign: 'center' }}>
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
        ) : viewMode === 'free' ? (
          /* ── Free diary entry (no goal) ──────── */
          <Box sx={{ pb: 3 }}>
            {renderJournalForm('#A78BFA')}
          </Box>
        ) : selectedGoal ? (
          /* ── Goal detail + widgets + journal ──── */
          <Box sx={{ pb: 2 }}>
            {/* Quick journal at top */}
            {renderJournalForm(domainColor(selectedGoal.domain))}
            
            <Divider sx={{ my: 3, mx: 2.5, borderColor: 'rgba(255,255,255,0.06)' }} />

            {/* Goal detail and widgets below */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase', px: 2.5 }}>
                Trackers & Progress
              </Typography>
              <NoteGoalDetail
                node={toFrontendNode(selectedGoal)}
                allNodes={rawNodes}
                userId={user?.id || ''}
                activeBets={activeBets}
                onProgressUpdate={handleProgressUpdate}
              />
            </Box>
          </Box>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default QuickLogDialog;
