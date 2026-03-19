import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Box, Typography, CircularProgress, IconButton, TextField, Button, Stack, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditNoteIcon from '@mui/icons-material/EditNote';
import GlassCard from '../../components/common/GlassCard';
import toast from 'react-hot-toast';
import { API_URL } from '../../lib/api';

interface NotebookNote {
  id: string;
  goal_id: string | null;
  content: string;
  mood: string | null;
  domain: string | null;
  occurred_at: string;
}

interface GoalNotesPanelProps {
  nodeId: string | null;
  nodeTitle: string;
  userId: string;
  compact?: boolean;  // Mobile compact mode
}

const GoalNotesPanel: React.FC<GoalNotesPanelProps> = ({ nodeId, nodeTitle, userId, compact = false }) => {
  const [notes, setNotes] = useState<NotebookNote[]>([]);
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
  
  const QUICK_EMOJIS = ['🎯', '⭐', '💡', '✅', '❌', '📝', '🚀', '💭', '❤️', '🤔', '👍', '🎉'];

  const handleInsertEmoji = (emoji: string) => {
    setNewNote(prev => prev + emoji);
  };

  const fetchNotes = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Authorization': `Bearer ${session?.access_token}` };
      
      let url = `${API_URL}/notebook/entries?entry_type=note&limit=100`;
      // If we have a valid UUID nodeId, filter by it
      if (nodeId && nodeId !== 'free-notes' && nodeId.length > 10) {
        url += `&goal_id=${nodeId}`;
      } else {
        // For free notes, the API currently returns all notes if goal_id is not provided.
        // We'll filter the "unlinked" ones in frontend for now to be safe, 
        // or just show all if no node is selected.
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      
      // If we are in "Free Notes" mode (nodeId is null/free-notes), only show entries with NO goal_id
      if (!nodeId || nodeId === 'free-notes') {
        setNotes((data || []).filter((n: any) => !n.goal_id));
      } else {
        setNotes(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotes();
    }
  }, [userId, nodeId]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAdding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const headers = { 
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      };

      const isFreeNote = !nodeId || nodeId === 'free-notes';

      const payload = {
        entry_type: 'note',
        content: newNote,
        mood: selectedMood,
        goal_id: isFreeNote ? null : nodeId,
        domain: isFreeNote ? 'Personal' : (notes[0]?.domain || 'General'),
        title: isFreeNote ? 'Free Note' : `Note for ${nodeTitle}`,
        source_table: 'manual_entry',
        source_id: 'manual',
      };

      const res = await fetch(`${API_URL}/notebook/entries`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to save');
      }

      toast.success('Note saved to notebook!');
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
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Authorization': `Bearer ${session?.access_token}` };
      
      const res = await fetch(`${API_URL}/notebook/entries/${noteId}`, {
        method: 'DELETE',
        headers
      });
      
      if (!res.ok) throw new Error('Failed to delete');
      
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
      height: compact ? 'auto' : '100%',
      overflowY: 'auto',
      p: compact ? 1 : 2,
    }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant={compact ? 'subtitle1' : 'h6'} sx={{ fontWeight: 700, mb: 0.5 }}>
          <EditNoteIcon sx={{ fontSize: compact ? 18 : 20, mr: 0.5, verticalAlign: 'middle' }} />
          {nodeId ? `Notes for "${nodeTitle}"` : 'Free Notes'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {nodeId ? 'Goal-specific reflections' : 'Standalone thoughts and insights'}
        </Typography>
      </Box>

      {/* Add Note Form */}
      <GlassCard sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
        <TextField
          fullWidth
          multiline
          rows={compact ? 2 : 3}
          placeholder={nodeId ? "Reflect on this goal..." : "What's on your mind?"}
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
        
        {/* Quick Emoji Picker */}
        <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
          {QUICK_EMOJIS.map((emoji) => (
            <IconButton
              key={emoji}
              size="small"
              onClick={() => handleInsertEmoji(emoji)}
              sx={{
                width: 32,
                height: 32,
                fontSize: '1.2rem',
                color: 'rgba(255,255,255,0.8)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              {emoji}
            </IconButton>
          ))}
        </Stack>

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
          {adding ? 'Saving...' : 'Save to Notebook'}
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
                    {formatDate(note.occurred_at)}
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
                {note.content}
              </Typography>
            </GlassCard>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default GoalNotesPanel;
