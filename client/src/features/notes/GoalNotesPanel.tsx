import React, { useEffect, useState } from 'react';
import {
  Box, Typography, CircularProgress, IconButton, TextField, Button, Stack, Chip, Alert, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditNoteIcon from '@mui/icons-material/EditNote';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GlassCard from '../../components/common/GlassCard';
import ContentRenderer from '../../components/common/ContentRenderer';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useOffline } from '../../hooks/useOffline';
import { getGeneralSuggestions, getSuggestionsForDomain, LoggingSuggestion } from '../../utils/loggingSuggestions';
import { useCurrentLocation, EntryLocation } from '../../hooks/useCurrentLocation';

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
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<LoggingSuggestion[]>([]);
  
  // Offline support
  const { isOnline, isOffline, hasPendingSync, pendingCount, saveForLater, forceSync } = useOffline();
  
  // Get cached location (only if enabled in settings)
  const getLocation = useCurrentLocation({ enabled: true });

  // Parity with ShareButton's "Share to Notebook" dialog — same options, same UI.
  const MOODS = [
    { emoji: '😊', label: 'Good', color: '#10B981' },
    { emoji: '😐', label: 'Okay', color: '#F59E0B' },
    { emoji: '😔', label: 'Low', color: '#6B7280' },
    { emoji: '🔥', label: 'Great', color: '#EF4444' },
  ];

  const GOAL_DOMAINS = [
    { value: 'Career', icon: '💼', color: '#F59E0B' },
    { value: 'Fitness', icon: '💪', color: '#EF4444' },
    { value: 'Investing / Financial Growth', icon: '📈', color: '#10B981' },
    { value: 'Mental Health', icon: '🧠', color: '#8B5CF6' },
  ];

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };
  const handleRemoveTag = (t: string) => setTags(tags.filter((x) => x !== t));
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
  };

  const QUICK_EMOJIS = ['🎯', '⭐', '💡', '✅', '❌', '📝', '🚀', '💭', '❤️', '🤔', '👍', '🎉'];

  // Load suggestions based on context
  useEffect(() => {
    if (nodeId) {
      // Goal-specific: extract domain from nodeTitle (simplified - in real app, pass domain as prop)
      setSuggestions(getSuggestionsForDomain('Personal')); // Default, will be improved
    } else {
      setSuggestions(getGeneralSuggestions());
    }
  }, [nodeId, nodeTitle]);

  const handleInsertSuggestion = (text: string) => {
    setNewNote(prev => {
      if (prev) return prev + '\n\n' + text;
      return text;
    });
    setShowSuggestions(false);
  };

  const handleInsertEmoji = (emoji: string) => {
    setNewNote(prev => prev + emoji);
  };

  const fetchNotes = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      let url = `/notebook/entries?entry_type=note&limit=100`;
      // If we have a valid UUID nodeId, filter by it
      if (nodeId && nodeId !== 'free-notes' && nodeId.length > 10) {
        url += `&goal_id=${nodeId}`;
      }

      const res = await api.get(url);
      const data = res.data;
      
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
      const isFreeNote = !nodeId || nodeId === 'free-notes';
      const location = getLocation();

      // User-picked domain overrides the auto-pick; tags travel in metadata like ShareButton.
      const domain = selectedDomain
        || (isFreeNote ? 'Personal' : (notes[0]?.domain || 'General'));
      const metadata: Record<string, any> = {};
      if (tags.length > 0) metadata.tags = tags;
      if (selectedMood) metadata.mood = selectedMood;

      const entry = {
        entry_type: 'note',
        content: newNote,
        mood: selectedMood,
        goal_id: isFreeNote ? undefined : nodeId,
        domain,
        title: isFreeNote ? 'Free Note' : `Note for ${nodeTitle}`,
        source_table: 'manual_entry',
        source_id: 'manual',
        metadata,
        // Add location data if available
        ...(location && {
          location_lat: location.lat,
          location_lng: location.lng,
          location_name: undefined,
        }),
        // Offline tracking metadata
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (isOffline) {
        // Save for later sync
        await saveForLater({
          ...entry,
          id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          synced: false,
          sync_attempted: 0,
          mood: selectedMood || undefined,
        });
      } else {
        // Send to API immediately
        await api.post('/notebook/entries', entry);
        toast.success('Note saved to notebook!');
      }

      setNewNote('');
      setSelectedMood(null);
      setSelectedDomain(null);
      setTags([]);
      setTagInput('');
      setShowDetails(false);
      await fetchNotes();
    } catch (err: any) {
      // If API fails but we're online, offer to save offline
      if (isOnline && err.message?.includes('network')) {
        const entry = {
          entry_type: 'note',
          content: newNote,
          mood: selectedMood || undefined,
          occurred_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        await saveForLater({
          ...entry,
          id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          synced: false,
          sync_attempted: 0,
        });
      } else {
        toast.error('Failed to add note: ' + err.message);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/notebook/entries/${noteId}`);
      
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant={compact ? 'subtitle1' : 'h6'} sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EditNoteIcon sx={{ fontSize: compact ? 18 : 20, mr: 0.5, verticalAlign: 'middle' }} />
            {nodeId ? `Notes for "${nodeTitle}"` : 'Free Notes'}
          </Typography>
          
          {/* Offline Status Indicator */}
          {hasPendingSync && (
            <Chip
              label={`${pendingCount} pending`}
              size="small"
              onClick={() => forceSync()}
              sx={{
                bgcolor: 'rgba(245, 158, 11, 0.2)',
                color: '#F59E0B',
                fontWeight: 700,
                fontSize: '0.65rem',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.3)' },
              }}
              icon={<SyncIcon />}
            />
          )}
          {isOffline && !hasPendingSync && (
            <Chip
              label="Offline"
              size="small"
              sx={{
                bgcolor: 'rgba(107, 114, 128, 0.2)',
                color: '#9CA3AF',
                fontWeight: 700,
                fontSize: '0.65rem',
              }}
              icon={<CloudOffIcon />}
            />
          )}
          {isOnline && hasPendingSync && (
            <Chip
              label="Syncing..."
              size="small"
              sx={{
                bgcolor: 'rgba(59, 130, 246, 0.2)',
                color: '#3B82F6',
                fontWeight: 700,
                fontSize: '0.65rem',
              }}
              icon={<CloudDoneIcon />}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {nodeId ? 'Goal-specific reflections' : 'Standalone thoughts and insights'}
          {isOffline && ' • Working offline'}
        </Typography>
      </Box>

      {/* Add Note Form */}
      <GlassCard sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
        {/* Offline Notice */}
        {isOffline && (
          <Alert
            severity="warning"
            sx={{ mb: 2, fontSize: '0.75rem' }}
            icon={<CloudOffIcon />}
          >
            You're offline. Notes will sync when you're back online.
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            <LightbulbIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
            {nodeId ? `Prompt for ${nodeTitle}` : 'What would be most useful to track?'}
          </Typography>
          <Button
            size="small"
            onClick={() => setShowSuggestions(!showSuggestions)}
            sx={{
              fontSize: '0.65rem',
              color: showSuggestions ? 'primary.main' : 'text.secondary',
              fontWeight: 700,
            }}
          >
            {showSuggestions ? 'Hide' : 'Show'} Prompts
          </Button>
        </Box>

        {/* Smart Suggestions */}
        {showSuggestions && (
          <Box sx={{ mb: 2 }}>
            <Stack spacing={0.75}>
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion.id}
                  label={suggestion.text}
                  size="small"
                  onClick={() => handleInsertSuggestion(suggestion.text)}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    height: 'auto',
                    minHeight: 32,
                    py: 0.5,
                    px: 1,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    bgcolor: 'rgba(167,139,250,0.08)',
                    color: '#A78BFA',
                    border: '1px solid rgba(167,139,250,0.2)',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(167,139,250,0.15)',
                      border: '1px solid rgba(167,139,250,0.4)',
                    },
                    '& .MuiChip-label': {
                      whiteSpace: 'normal',
                      padding: '4px 8px',
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        <TextField
          fullWidth
          multiline
          rows={compact ? 2 : 3}
          placeholder={nodeId ? 'Reflect on this goal...' : "✨ What's on your mind?"}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(139,92,246,0.03)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 2,
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': { borderColor: 'rgba(139,92,246,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#A78BFA' },
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

        {/* Optional details — same options as ShareButton's Share-to-Notebook dialog */}
        <Box sx={{ mb: 1 }}>
          <Button
            variant="text"
            size="small"
            onClick={() => setShowDetails(!showDetails)}
            startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{
              color: '#A78BFA',
              fontWeight: 700,
              fontSize: '0.75rem',
              '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
            }}
          >
            {showDetails ? 'Hide options' : 'Add details (optional)'}
          </Button>

          <Collapse in={showDetails}>
            <Box sx={{ mt: 1.5 }}>
              {/* Domain & Mood — side by side, emoji chips */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                    🏷️ DOMAIN
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {GOAL_DOMAINS.map((d) => (
                      <Chip
                        key={d.value}
                        label={d.icon}
                        onClick={() => setSelectedDomain(selectedDomain === d.value ? null : d.value)}
                        size="small"
                        sx={{
                          bgcolor: selectedDomain === d.value ? d.color : 'rgba(255,255,255,0.05)',
                          color: selectedDomain === d.value ? '#fff' : 'text.secondary',
                          fontSize: '0.85rem',
                          width: 32,
                          height: 32,
                          minWidth: 'auto',
                          padding: 0,
                          border: selectedDomain === d.value ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                    😊 MOOD
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {MOODS.map((mood) => (
                      <Chip
                        key={mood.label}
                        label={mood.emoji}
                        onClick={() => setSelectedMood(selectedMood === mood.label ? null : mood.label)}
                        size="small"
                        sx={{
                          bgcolor: selectedMood === mood.label ? mood.color : 'rgba(255,255,255,0.05)',
                          color: selectedMood === mood.label ? '#fff' : 'text.secondary',
                          fontSize: '1rem',
                          width: 32,
                          height: 32,
                          minWidth: 'auto',
                          padding: 0,
                          border: selectedMood === mood.label ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* Tags */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  🏷️ TAGS
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    fullWidth
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(255,255,255,0.03)',
                        fontSize: '0.85rem',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        '&.Mui-focused fieldset': { borderColor: '#A78BFA' },
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    sx={{
                      bgcolor: '#A78BFA',
                      color: '#0A0B14',
                      fontWeight: 700,
                      minWidth: 'auto',
                      px: 2,
                      '&:hover': { bgcolor: '#8B5CF6' },
                      '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'text.disabled' },
                    }}
                  >
                    Add
                  </Button>
                </Box>
                {tags.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                    {tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={`#${tag}`}
                        onDelete={() => handleRemoveTag(tag)}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(139,92,246,0.15)',
                          color: '#A78BFA',
                          border: '1px solid rgba(139,92,246,0.3)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Collapse>
        </Box>

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
              <ContentRenderer
                content={note.content}
                variant="comment"
                sx={{ whiteSpace: 'pre-wrap' }}
              />
            </GlassCard>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default GoalNotesPanel;
