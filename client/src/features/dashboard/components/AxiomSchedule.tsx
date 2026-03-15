import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ShareIcon from '@mui/icons-material/Share';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EventIcon from '@mui/icons-material/Event';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import toast from 'react-hot-toast';
import GlassCard from '../../components/common/GlassCard';

// Types
interface TimeSlot {
  id?: string;
  hour: number;
  timeLabel: string;
  task: string;
  alignment: string;
  duration: string;
  preparation: string;
  isFlexible: boolean;
  priority: 'high' | 'medium' | 'low';
  category: 'deep_work' | 'admin' | 'rest' | 'exercise' | 'social' | 'learning' | 'planning' | 'reflection';
  suggestedMatchId?: string;
  suggestedMatchName?: string;
  suggestedPlaceId?: string;
  suggestedPlaceName?: string;
  suggestedEventId?: string;
  suggestedEventName?: string;
  isCompleted?: boolean;
  completion?: {
    completed_at: string;
    note?: string;
    mood?: string;
  };
}

interface DailySchedule {
  schedule_id?: string;
  id?: string;
  date: string;
  wakeTime: string;
  sleepTime: string;
  totalWorkHours: number;
  totalRestHours: number;
  focusTheme: string;
  energyCurve: 'morning_peak' | 'evening_peak' | 'balanced';
  timeSlots: TimeSlot[];
}

interface ShareableSlot {
  schedule: { id: string; date: string; focusTheme: string };
  slot: {
    id: string;
    hour: number;
    timeLabel: string;
    task: string;
    alignment: string;
    duration: string;
    category: string;
    priority: string;
  };
  suggestions: {
    match?: { id: string; name: string; avatar_url?: string; bio?: string };
    place?: { id: string; name: string; description?: string; city?: string; tags?: string[] };
    event?: { id: string; title: string; description?: string; event_date?: string; city?: string };
  };
}

interface AxiomScheduleProps {
  userId: string;
  selectedDate?: string;
  onSlotComplete?: (slot: TimeSlot) => void;
}

// Category color mapping
const categoryColors: Record<string, { bg: string; border: string; text: string; chip: string }> = {
  deep_work: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.3)', text: '#A78BFA', chip: 'rgba(139,92,246,0.15)' },
  admin: { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.3)', text: '#9CA3AF', chip: 'rgba(107,114,128,0.15)' },
  rest: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', text: '#60A5FA', chip: 'rgba(59,130,246,0.15)' },
  exercise: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', text: '#F87171', chip: 'rgba(239,68,68,0.15)' },
  social: { bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.3)', text: '#F472B6', chip: 'rgba(236,72,153,0.15)' },
  learning: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', text: '#34D399', chip: 'rgba(16,185,129,0.15)' },
  planning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', text: '#FBBF24', chip: 'rgba(245,158,11,0.15)' },
  reflection: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.3)', text: '#C084FC', chip: 'rgba(139,92,246,0.15)' },
};

const priorityColors: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const AxiomSchedule: React.FC<AxiomScheduleProps> = ({ userId, selectedDate, onSlotComplete }) => {
  const [schedule, setSchedule] = useState<DailySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteMood, setNoteMood] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareableSlot, setShareableSlot] = useState<ShareableSlot | null>(null);

  const date = selectedDate || new Date().toISOString().slice(0, 10);

  // Fetch schedule
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const token = await supabase.auth.getSession().then(s => s.session?.access_token);
      if (!token) return;

      const response = await fetch(`${API_URL}/schedule/${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.schedule) {
          setSchedule(data.schedule);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Handle slot click - open note dialog
  const handleSlotClick = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setNoteText(slot.completion?.note || '');
    setNoteMood(slot.completion?.mood || '');
    setNoteDialogOpen(true);
  };

  // Handle slot completion toggle
  const handleCompleteSlot = async (slot: TimeSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const token = await supabase.auth.getSession().then(s => s.session?.access_token);
    if (!token || !schedule?.id) return;

    try {
      const response = await fetch(`${API_URL}/schedule/${schedule.id}/slots/${slot.hour}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          note: noteText || undefined,
          mood: noteMood || undefined,
        }),
      });

      if (response.ok) {
        toast.success(slot.isCompleted ? 'Marked as incomplete' : 'Slot completed! 🎯');
        fetchSchedule();
        onSlotComplete?.(slot);
      }
    } catch (err: any) {
      toast.error('Failed to update slot');
    }
  };

  // Handle save note
  const handleSaveNote = async () => {
    if (!selectedSlot || !schedule?.id) return;
    
    setSavingNote(true);
    try {
      const token = await supabase.auth.getSession().then(s => s.session?.access_token);
      if (!token) return;

      const response = await fetch(`${API_URL}/schedule/${schedule.id}/slots/${selectedSlot.hour}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          note: noteText,
          mood: noteMood,
        }),
      });

      if (response.ok) {
        toast.success('Note saved to diary! 📓');
        setNoteDialogOpen(false);
        fetchSchedule();
      }
    } catch (err: any) {
      toast.error('Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  // Handle share slot
  const handleShareSlot = async (slot: TimeSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const token = await supabase.auth.getSession().then(s => s.session?.access_token);
      if (!token || !schedule?.id) return;

      const response = await fetch(`${API_URL}/schedule/${schedule.id}/slots/${slot.hour}/share`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setShareableSlot(data);
        setShareDialogOpen(true);
      }
    } catch (err: any) {
      toast.error('Failed to load share data');
    }
  };

  // Handle regenerate schedule
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const token = await supabase.auth.getSession().then(s => s.session?.access_token);
      if (!token) return;

      const response = await fetch(`${API_URL}/schedule/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date }),
      });

      if (response.ok) {
        toast.success('Schedule regenerated! ✨');
        fetchSchedule();
      }
    } catch (err: any) {
      toast.error('Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  // Handle share to diary
  const handleShareToDiary = async () => {
    if (!shareableSlot) return;
    
    try {
      const token = await supabase.auth.getSession().then(s => s.session?.access_token);
      if (!token) return;

      // Create diary entry with quoted schedule item
      const content = `📅 **Scheduled: ${shareableSlot.slot.timeLabel}**

**Task:** ${shareableSlot.slot.task}

**Why it matters:** ${shareableSlot.slot.alignment}

**Category:** ${shareableSlot.slot.category} | **Priority:** ${shareableSlot.slot.priority}

---

${shareableSlot.suggestions.match ? `👥 **Suggested Partner:** ${shareableSlot.suggestions.match.name}\n${shareableSlot.suggestions.match.bio || ''}\n\n` : ''}
${shareableSlot.suggestions.place ? `📍 **Suggested Place:** ${shareableSlot.suggestions.place.name}\n${shareableSlot.suggestions.place.description || ''}\n${shareableSlot.suggestions.place.city ? `Location: ${shareableSlot.suggestions.place.city}\n` : ''}\n\n` : ''}
${shareableSlot.suggestions.event ? `🎯 **Suggested Event:** ${shareableSlot.suggestions.event.title}\n${shareableSlot.suggestions.event.description || ''}\n${shareableSlot.suggestions.event.event_date ? `Date: ${new Date(shareableSlot.suggestions.event.event_date).toLocaleDateString()}\n` : ''}\n` : ''}
---

*From Axiom's daily schedule for ${shareableSlot.schedule.date}*`;

      const response = await fetch(`${API_URL}/diary/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entry_type: 'schedule_share',
          title: `Schedule: ${shareableSlot.slot.timeLabel} - ${shareableSlot.slot.task}`,
          content,
          source_table: 'axiom_schedules',
          source_id: shareableSlot.schedule.id,
          metadata: {
            slot_id: shareableSlot.slot.id,
            hour: shareableSlot.slot.hour,
            category: shareableSlot.slot.category,
            priority: shareableSlot.slot.priority,
          },
          is_private: false, // Shareable to accountability network
        }),
      });

      if (response.ok) {
        toast.success('Shared to diary! 📓');
        setShareDialogOpen(false);
      }
    } catch (err: any) {
      toast.error('Failed to share');
    }
  };

  // Filter slots
  const filteredSlots = schedule?.timeSlots.filter(slot => {
    if (filter === 'all') return true;
    if (filter === 'completed') return slot.isCompleted;
    if (filter === 'pending') return !slot.isCompleted;
    if (filter === 'high_priority') return slot.priority === 'high';
    return slot.category === filter;
  }) || [];

  if (loading) {
    return (
      <GlassCard sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">Loading your schedule...</Typography>
      </GlassCard>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            📅 Daily Schedule
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {schedule?.focusTheme || 'Your personalized hourly plan'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Regenerate with AI">
            <IconButton onClick={handleRegenerate} disabled={regenerating} size="small">
              <RefreshIcon sx={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats */}
      {schedule && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`⏰ ${schedule.totalWorkHours}h work`}
            size="small"
            sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}
          />
          <Chip
            label={`😴 ${schedule.totalRestHours}h rest`}
            size="small"
            sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}
          />
          <Chip
            label={`🎯 ${schedule.timeSlots.filter(s => s.priority === 'high').length} high priority`}
            size="small"
            sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#F87171' }}
          />
          <Chip
            label={`✅ ${schedule.timeSlots.filter(s => s.isCompleted).length}/${schedule.timeSlots.length} done`}
            size="small"
            sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10B981' }}
          />
        </Box>
      )}

      {/* Filter */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip
          label="All"
          size="small"
          onClick={() => setFilter('all')}
          sx={{ bgcolor: filter === 'all' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)', color: filter === 'all' ? '#A78BFA' : 'text.secondary' }}
        />
        <Chip
          label="High Priority"
          size="small"
          onClick={() => setFilter('high_priority')}
          sx={{ bgcolor: filter === 'high_priority' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', color: filter === 'high_priority' ? '#F87171' : 'text.secondary' }}
        />
        <Chip
          label="Pending"
          size="small"
          onClick={() => setFilter('pending')}
          sx={{ bgcolor: filter === 'pending' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', color: filter === 'pending' ? '#FBBF24' : 'text.secondary' }}
        />
        <Chip
          label="Completed"
          size="small"
          onClick={() => setFilter('completed')}
          sx={{ bgcolor: filter === 'completed' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)', color: filter === 'completed' ? '#10B981' : 'text.secondary' }}
        />
        {Object.keys(categoryColors).map(cat => (
          <Chip
            key={cat}
            label={cat.replace('_', ' ')}
            size="small"
            onClick={() => setFilter(cat)}
            sx={{ bgcolor: filter === cat ? categoryColors[cat].chip : 'rgba(255,255,255,0.05)', color: filter === cat ? categoryColors[cat].text : 'text.secondary' }}
          />
        ))}
      </Box>

      {/* Time slots */}
      <Stack spacing={1.5}>
        {filteredSlots.map((slot) => {
          const colors = categoryColors[slot.category] || categoryColors.admin;
          
          return (
            <GlassCard
              key={slot.hour}
              onClick={() => handleSlotClick(slot)}
              sx={{
                p: 2,
                cursor: 'pointer',
                border: `1px solid ${slot.isCompleted ? 'rgba(16,185,129,0.3)' : colors.border}`,
                bgcolor: slot.isCompleted ? 'rgba(16,185,129,0.05)' : colors.bg,
                opacity: slot.isCompleted ? 0.7 : 1,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                {/* Time */}
                <Box sx={{ minWidth: 80 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <AccessTimeIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      {slot.timeLabel}
                    </Typography>
                  </Box>
                  <Chip
                    label={slot.duration}
                    size="small"
                    sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.1)' }}
                  />
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {slot.task}
                    </Typography>
                    {slot.priority === 'high' && (
                      <Chip label="!" size="small" sx={{ height: 16, bgcolor: priorityColors.high, color: '#fff', fontSize: '0.55rem' }} />
                    )}
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {slot.alignment}
                  </Typography>

                  {/* Suggestions */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {slot.suggestedMatchName && (
                      <Chip
                        icon={<PersonIcon />}
                        label={slot.suggestedMatchName}
                        size="small"
                        sx={{ height: 20, bgcolor: 'rgba(236,72,153,0.15)', color: '#F472B6', fontSize: '0.6rem' }}
                      />
                    )}
                    {slot.suggestedPlaceName && (
                      <Chip
                        icon={<LocationOnIcon />}
                        label={slot.suggestedPlaceName}
                        size="small"
                        sx={{ height: 20, bgcolor: 'rgba(99,102,241,0.15)', color: '#6366F1', fontSize: '0.6rem' }}
                      />
                    )}
                    {slot.suggestedEventName && (
                      <Chip
                        icon={<EventIcon />}
                        label={slot.suggestedEventName}
                        size="small"
                        sx={{ height: 20, bgcolor: 'rgba(245,158,11,0.15)', color: '#FBBF24', fontSize: '0.6rem' }}
                      />
                    )}
                  </Box>

                  {/* Preparation */}
                  {slot.preparation && (
                    <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, border: '1px dashed rgba(255,255,255,0.1)' }}>
                      <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'block', mb: 0.25 }}>
                        🎯 Prepare:
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {slot.preparation}
                      </Typography>
                    </Box>
                  )}

                  {/* Completion note preview */}
                  {slot.completion?.note && (
                    <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(16,185,129,0.08)', borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        "{slot.completion.note.slice(0, 80)}{slot.completion.note.length > 80 ? '...' : ''}"
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Tooltip title={slot.isCompleted ? 'Mark incomplete' : 'Mark complete'}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleCompleteSlot(slot, e)}
                      sx={{ color: slot.isCompleted ? '#10B981' : 'text.secondary' }}
                    >
                      {slot.isCompleted ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Add note">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleSlotClick(slot); }}>
                      <EditNoteIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Share to diary">
                    <IconButton size="small" onClick={(e) => handleShareSlot(slot, e)}>
                      <ShareIcon sx={{ fontSize: '1rem' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </GlassCard>
          );
        })}
      </Stack>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {selectedSlot?.timeLabel} - {selectedSlot?.task}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note about this time slot..."
            sx={{ mt: 2, mb: 2 }}
          />
          <Autocomplete
            options={['neutral', 'good', 'great', 'challenging', 'tired', 'focused', 'distracted']}
            value={noteMood || null}
            onChange={(_, val) => setNoteMood(val || '')}
            renderInput={(params) => (
              <TextField {...params} label="How did it go?" placeholder="Select a mood" />
            )}
            freeSolo
          />
          {selectedSlot?.preparation && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>🎯 Preparation:</Typography>
              {selectedSlot.preparation}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveNote} variant="contained" disabled={savingNote}>
            {savingNote ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Share to Diary</Typography>
        </DialogTitle>
        <DialogContent>
          {shareableSlot && (
            <Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Share this scheduled time slot to your diary? This will create a post with:
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  📅 {shareableSlot.slot.timeLabel}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {shareableSlot.slot.task}
                </Typography>
                {shareableSlot.suggestions.match && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#F472B6' }}>
                    👥 With {shareableSlot.suggestions.match.name}
                  </Typography>
                )}
                {shareableSlot.suggestions.place && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#6366F1' }}>
                    📍 At {shareableSlot.suggestions.place.name}
                  </Typography>
                )}
                {shareableSlot.suggestions.event && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#FBBF24' }}>
                    🎯 Event: {shareableSlot.suggestions.event.title}
                  </Typography>
                )}
              </Box>
              <Alert severity="info">
                This will be visible to your accountability network (unless you mark it private later).
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleShareToDiary} variant="contained">
            Share to Diary
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AxiomSchedule;
