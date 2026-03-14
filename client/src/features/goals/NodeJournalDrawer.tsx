import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, TextField, Button, Chip,
  Stack, IconButton, CircularProgress, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BookIcon from '@mui/icons-material/MenuBook';
import SendIcon from '@mui/icons-material/Send';
import api from '../../lib/api';
import { GoalNode as FrontendGoalNode } from '../../types/goal';

const MOODS = ['🔥', '💪', '😤', '😌', '😴', '😕'] as const;
type Mood = typeof MOODS[number];

interface JournalEntry {
  id: string;
  node_id: string;
  note: string | null;
  mood: string | null;
  logged_at: string;
}

interface Props {
  open: boolean;
  node: FrontendGoalNode | null;
  onClose: () => void;
}

const NodeJournalDrawer: React.FC<Props> = ({ open, node, onClose }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<Mood | ''>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!node) return;
    setLoading(true);
    try {
      const { data } = await api.get<JournalEntry[]>('/journal/entries', {
        params: { nodeId: node.id },
      });
      setEntries(data ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [node]);

  useEffect(() => {
    if (open && node) {
      fetchEntries();
      setNote('');
      setMood('');
    }
  }, [open, node, fetchEntries]);

  const handleSubmit = async () => {
    if (!node || !note.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/journal/entries', {
        nodeId: node.id,
        note: note.trim(),
        mood: mood || null,
      });
      setNote('');
      setMood('');
      fetchEntries();
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 420 },
          bgcolor: '#0F1117',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, py: 2,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 1.5,
      }}>
        <BookIcon sx={{ color: '#8B5CF6', fontSize: 22 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            Goal Journal
          </Typography>
          {node && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {node.title}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Compose area */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <TextField
          multiline
          rows={3}
          fullWidth
          placeholder="What's on your mind about this goal today?"
          value={note}
          onChange={e => setNote(e.target.value)}
          variant="outlined"
          size="small"
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.03)',
              borderRadius: '10px',
            },
          }}
        />

        {/* Mood selector */}
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={0.5}>
            {MOODS.map(m => (
              <Chip
                key={m}
                label={m}
                size="small"
                onClick={() => setMood(mood === m ? '' : m)}
                sx={{
                  cursor: 'pointer',
                  fontSize: '1rem',
                  bgcolor: mood === m ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                  border: mood === m ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  '&:hover': { bgcolor: 'rgba(139,92,246,0.15)' },
                }}
              />
            ))}
          </Stack>

          <Button
            variant="contained"
            size="small"
            endIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
            disabled={!note.trim() || submitting}
            onClick={handleSubmit}
            sx={{
              borderRadius: '8px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
              '&:hover': { background: 'linear-gradient(135deg, #9333EA, #4F46E5)' },
            }}
          >
            Log
          </Button>
        </Stack>
      </Box>

      {/* Entries list */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 3, py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress size={28} sx={{ color: '#8B5CF6' }} />
          </Box>
        ) : entries.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 6, opacity: 0.5 }}>
            <BookIcon sx={{ fontSize: 40, mb: 1, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary">
              No entries yet. Start journaling about this goal.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {entries.map((entry, i) => (
              <Box key={entry.id}>
                <Box sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                    <Typography variant="caption" color="text.disabled">
                      {formatDate(entry.logged_at)}
                    </Typography>
                    {entry.mood && (
                      <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{entry.mood}</Typography>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {entry.note}
                  </Typography>
                </Box>
                {i < entries.length - 1 && (
                  <Divider sx={{ mt: 2, borderColor: 'rgba(255,255,255,0.04)' }} />
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};

export default NodeJournalDrawer;
