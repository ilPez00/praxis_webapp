import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Box, Typography, CircularProgress, IconButton, TextField, Button, Stack, Divider, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditNoteIcon from '@mui/icons-material/EditNote';
import GlassCard from '../../components/common/GlassCard';
import toast from 'react-hot-toast';

interface GoalNote {
  id: string;
  node_id: string;
  note: string;
  mood: string | null;
  created_at: string;
}

interface GoalNotesPanelProps {
  nodeId: string;
  nodeTitle: string;
  userId: string;
}

const GoalNotesPanel: React.FC<GoalNotesPanelProps> = ({ nodeId, nodeTitle, userId }) => {
  const [notes, setNotes] = useState<GoalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const MOODS = [
    { emoji: '😊', label: 'Good' },
    { emoji: '😐', label: 'Okay' },
    { emoji: '😔', label: 'Low' },
    { emoji: '🔥', label: 'Great' },
    { emoji: '💪', label: 'Strong' },
  ];

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('node_id', nodeId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && nodeId) {
      fetchNotes();
    }
  }, [userId, nodeId]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAdding(true);
    try {
      const { error } = await supabase.from('journal_entries').insert({
        node_id: nodeId,
        user_id: userId,
        note: newNote,
        mood: selectedMood,
      });

      if (error) throw error;

      toast.success('Note added!');
      setNewNote('');
      setSelectedMood(null);
      await fetchNotes();
    } catch (err: any) {
      toast.error('Failed to add note: ' + err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from('journal_entries').delete().eq('id', noteId);
      if (error) throw error;
      toast.success('Note deleted');
      await fetchNotes();
    } catch (err: any) {
      toast.error('Failed to delete note');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Box sx={{
      height: '100%',
      overflowY: 'auto',
      p: 2,
    }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          <EditNoteIcon sx={{ fontSize: 20, mr: 0.5, verticalAlign: 'middle' }} />
          Notes for "{nodeTitle}"
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Journal entries and reflections
        </Typography>
      </Box>

      {/* Add Note Form */}
      <GlassCard sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="Add a note about your progress..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          sx={{
            mb: 1,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(0,0,0,0.2)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
        />

        {/* Mood Selection */}
        <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
          {MOODS.map((mood) => (
            <Chip
              key={mood.label}
              label={`${mood.emoji} ${mood.label}`}
              size="small"
              onClick={() => setSelectedMood(selectedMood === mood.label ? null : mood.label)}
              sx={{
                bgcolor: selectedMood === mood.label ? 'primary.main' : 'rgba(255,255,255,0.08)',
                color: selectedMood === mood.label ? '#000' : 'rgba(255,255,255,0.7)',
                fontWeight: selectedMood === mood.label ? 700 : 500,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
              }}
            />
          ))}
        </Stack>

        <Button
          variant="contained"
          fullWidth
          onClick={handleAddNote}
          disabled={adding || !newNote.trim()}
          startIcon={adding ? <CircularProgress size={18} /> : <AddIcon />}
          sx={{
            bgcolor: 'primary.main',
            color: '#000',
            fontWeight: 700,
            '&:disabled': { opacity: 0.5 },
          }}
        >
          {adding ? 'Adding...' : 'Add Note'}
        </Button>
      </GlassCard>

      {/* Notes List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : notes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          <EditNoteIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography>No notes yet</Typography>
          <Typography variant="caption">Add your first note above</Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {notes.map((note) => (
            <GlassCard
              key={note.id}
              sx={{
                p: 2,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {note.mood && (
                    <Chip
                      label={note.mood}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(note.created_at)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteNote(note.id)}
                  sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#EF4444' } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {note.note}
              </Typography>
            </GlassCard>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default GoalNotesPanel;
