import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Box, Typography, TextField, Button, Chip,
  Stack, IconButton, CircularProgress, Divider, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BookIcon from '@mui/icons-material/MenuBook';
import SendIcon from '@mui/icons-material/Send';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import api from '../../lib/api';
import { GoalNode as FrontendGoalNode } from '../../types/goal';
import { db, LocalJournalEntry } from '../../lib/db';

const MOODS = ['🔥', '💪', '😤', '😌', '😴', '😕'] as const;
type Mood = typeof MOODS[number];

interface Props {
  open: boolean;
  node: FrontendGoalNode | null;
  onClose: () => void;
}

const NodeJournalDrawer: React.FC<Props> = ({ open, node, onClose }) => {
  const [entries, setEntries] = useState<LocalJournalEntry[]>([]);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<Mood | ''>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!node) return;
    setLoading(true);
    try {
      // 1. Get from local DB first
      const local = await db.journalEntries
        .where('node_id')
        .equals(node.id)
        .reverse()
        .sortBy('logged_at');
      
      setEntries(local);

      // 2. Fetch from server and sync
      const { data: serverEntries } = await api.get<any[]>('/journal/entries', {
        params: { nodeId: node.id },
      });

      if (serverEntries) {
        // Update local DB with server data (reconcile)
        for (const se of serverEntries) {
          const existing = await db.journalEntries
            .where('logged_at')
            .equals(se.logged_at)
            .first();
          
          if (!existing) {
            await db.journalEntries.add({
              node_id: node.id,
              note: se.note,
              mood: se.mood,
              logged_at: se.logged_at,
              sync_status: 'synced'
            });
          } else if (existing.sync_status !== 'synced') {
            await db.journalEntries.update(existing.id!, { sync_status: 'synced' });
          }
        }

        // Final refresh from local DB
        const refreshed = await db.journalEntries
          .where('node_id')
          .equals(node.id)
          .reverse()
          .sortBy('logged_at');
        setEntries(refreshed);
      }
    } catch (err) {
      console.error('Fetch journal error:', err);
      // Fallback: we already show local entries
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
    
    const newEntry: LocalJournalEntry = {
      node_id: node.id,
      note: note.trim(),
      mood: mood || null,
      logged_at: new Date().toISOString(),
      sync_status: 'pending'
    };

    try {
      // 1. Save to local DB immediately (Optimistic UI)
      const localId = await db.journalEntries.add(newEntry);
      setEntries(prev => [ { ...newEntry, id: String(localId) }, ...prev ]);
      setNote('');
      setMood('');

      // 2. Try to sync with server
      try {
        await api.post('/journal/entries', {
          nodeId: node.id,
          note: newEntry.note,
          mood: newEntry.mood,
        });
        // Update status to synced
        await db.journalEntries.update(localId, { sync_status: 'synced' });
        setEntries(prev => prev.map(e => String(e.id) === String(localId) ? { ...e, sync_status: 'synced' } : e));
      } catch (syncErr) {
        console.warn('Sync failed, entry remains pending in local DB:', syncErr);
        // We don't throw here, the entry is safely in IndexedDB
      }
    } catch (err) {
      console.error('Failed to save journal entry locally:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getSyncIcon = (status: string) => {
    switch (status) {
      case 'synced': return <CloudDoneIcon sx={{ fontSize: 14, color: 'success.main' }} />;
      case 'pending': return <CloudQueueIcon sx={{ fontSize: 14, color: 'warning.main' }} />;
      case 'failed': return <CloudOffIcon sx={{ fontSize: 14, color: 'error.main' }} />;
      default: return null;
    }
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
        {loading && entries.length === 0 ? (
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
              <Box key={entry.id || i}>
                <Box sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.disabled">
                        {formatDate(entry.logged_at)}
                      </Typography>
                      <Tooltip title={entry.sync_status === 'synced' ? 'Synced with cloud' : 'Waiting to sync'}>
                        <Box sx={{ display: 'flex' }}>
                          {getSyncIcon(entry.sync_status)}
                        </Box>
                      </Tooltip>
                    </Stack>
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
