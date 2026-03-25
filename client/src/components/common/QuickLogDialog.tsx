import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogContent, Box, Typography, TextField, Button, Chip,
  Slide, IconButton, CircularProgress, Divider,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { DOMAIN_COLORS, DOMAIN_ICONS, GoalNode as FrontendGoalNode } from '../../types/goal';
import { DOMAIN_TRACKER_MAP } from '../../features/trackers/trackerTypes';
import { getGeneralSuggestions, getSuggestionsForDomain, LoggingSuggestion } from '../../utils/loggingSuggestions';
import NoteGoalDetail from '../../features/notes/NoteGoalDetail';
import NoteAttachmentBar from './NoteAttachmentBar';
import type { Attachment } from './NoteAttachmentBar';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';

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
  { emoji: '🔥', label: 'Great' },
  { emoji: '😊', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😔', label: 'Low' },
  { emoji: '💪', label: 'Strong' },
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
  const getLocation = useCurrentLocation();
  const [rawNodes, setRawNodes] = useState<RawGoalNode[]>([]);
  const [goals, setGoals] = useState<RawGoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<RawGoalNode | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('selector');
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeBets, setActiveBets] = useState<any[]>([]);
  const [freeAttachments, setFreeAttachments] = useState<Attachment[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<LoggingSuggestion[]>([]);
  const [todayLogCounts, setTodayLogCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    setSelectedGoal(null);
    setViewMode('selector');
    setNote('');
    setMood(null);
    setFreeAttachments([]);

    // Fetch goals + bets + today's tracker logs in parallel
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
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
      api.get('/trackers/my?days=1').catch(() => ({ data: [] })),
    ]).then(([treeRes, betsRes, trackersRes]) => {
      if (treeRes.data?.nodes && Array.isArray(treeRes.data.nodes)) {
        const all = treeRes.data.nodes as RawGoalNode[];
        setRawNodes(all);
        setGoals(all.filter(n => n.status !== 'suspended' && n.status !== 'completed'));
      }
      setActiveBets(Array.isArray(betsRes.data) ? betsRes.data : []);

      // Count today's entries per tracker type
      const todayStr = new Date().toISOString().slice(0, 10);
      const counts: Record<string, number> = {};
      const trackers = Array.isArray(trackersRes.data) ? trackersRes.data : [];
      for (const t of trackers) {
        const todayEntries = Array.isArray(t.entries)
          ? t.entries.filter((e: any) => e.logged_at?.slice(0, 10) === todayStr)
          : [];
        if (todayEntries.length > 0) counts[t.type] = todayEntries.length;
      }
      setTodayLogCounts(counts);

      setLoading(false);
    });
  }, [open, user?.id]);

  // Update suggestions when goal selection changes
  useEffect(() => {
    if (selectedGoal) {
      setSuggestions(getSuggestionsForDomain(selectedGoal.domain));
    } else if (viewMode === 'free') {
      setSuggestions(getGeneralSuggestions());
    }
  }, [selectedGoal, viewMode]);

  // Time-of-day smart sorting: boost domains relevant to current time
  const sortedGoals = useMemo(() => {
    const hour = new Date().getHours();
    // Priority domains by time slot (higher = shown first)
    const timePriority: Record<string, number> = {};
    if (hour >= 5 && hour < 11) {
      // Morning: fitness, mental health, meal prep
      Object.assign(timePriority, { 'Fitness': 3, 'Mental Health': 2, 'Personal Goals': 1 });
    } else if (hour >= 11 && hour < 17) {
      // Midday: career, academics, investing
      Object.assign(timePriority, { 'Career': 3, 'Academics': 2, 'Investing / Financial Growth': 1 });
    } else if (hour >= 17 && hour < 21) {
      // Evening: fitness, hobbies, social
      Object.assign(timePriority, { 'Fitness': 3, 'Culture / Hobbies / Creative Pursuits': 2, 'Friendship / Social Engagement': 1 });
    } else {
      // Night: reflection, philosophy, personal
      Object.assign(timePriority, { 'Mental Health': 3, 'Philosophical Development': 2, 'Personal Goals': 1 });
    }
    return [...goals].sort((a, b) => (timePriority[b.domain] || 0) - (timePriority[a.domain] || 0));
  }, [goals]);

  const handleInsertSuggestion = (text: string) => {
    setNote(prev => {
      if (prev) return prev + '\n\n' + text;
      return text;
    });
  };

  const handleSelectGoal = (goal: RawGoalNode) => {
    setSelectedGoal(goal);
    setViewMode('goal');
  };

  const handleBack = () => {
    setSelectedGoal(null);
    setViewMode('selector');
    setNote('');
    setMood(null);
    setFreeAttachments([]);
  };

  const handleSaveJournal = async () => {
    if (!user?.id) return;
    if (!note.trim() && !mood) { toast.error('Write a note or pick a mood.'); return; }
    setSaving(true);
    try {
      const contentText = note.trim() || (mood ? `Mood: ${mood}` : '');
      const location = getLocation();

      // Unified write: notebook_entries
      await api.post('/notebook/entries', {
        entry_type: 'note',
        content: contentText,
        mood: mood || undefined,
        goal_id: selectedGoal?.id || null,
        domain: selectedGoal?.domain || 'Personal',
        title: selectedGoal ? `Note for ${selectedGoal.name}` : 'Free Note',
        attachments: freeAttachments.length > 0 ? freeAttachments : undefined,
        // Add location data if available
        ...(location && {
          location_lat: location.lat,
          location_lng: location.lng,
          location_name: undefined,
        }),
      });

      toast.success('Saved to notebook!');
      setNote('');
      setMood(null);
      setFreeAttachments([]);
      onClose();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const domainColor = (domain: string) => DOMAIN_COLORS[domain] || '#A78BFA';

  const toFrontendNode = (raw: RawGoalNode): FrontendGoalNode => ({
    id: raw.id,
    title: raw.name,
    progress: Math.round(raw.progress * 100),
    children: [], // Simplified for widget view
    domain: raw.domain as any,
  });

  const headerTitle = viewMode === 'goal' && selectedGoal
    ? selectedGoal.name
    : viewMode === 'free'
    ? 'Free Note'
    : 'Quick Log';

  // Shared journal form
  const renderJournalForm = (accentColor: string) => (
    <Box sx={{ px: 2.5 }}>
      {/* Smart Suggestions Toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LightbulbIcon sx={{ fontSize: 14 }} />
          {selectedGoal ? `Track ${selectedGoal.name}` : 'What to track?'}
        </Typography>
        <Button
          size="small"
          onClick={() => setShowSuggestions(!showSuggestions)}
          sx={{
            fontSize: '0.65rem',
            color: showSuggestions ? accentColor : 'rgba(255,255,255,0.5)',
            fontWeight: 700,
            minWidth: 'auto',
            px: 1,
          }}
        >
          {showSuggestions ? 'Hide' : 'Show'}
        </Button>
      </Box>

      {/* Smart Suggestions */}
      {showSuggestions && (
        <Box sx={{ mb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {suggestions.map(s => (
            <Chip
              key={s.id}
              label={s.text}
              size="small"
              onClick={() => handleInsertSuggestion(s.text)}
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                height: 'auto',
                minHeight: 32,
                py: 0.5,
                px: 1,
                fontSize: '0.75rem',
                fontWeight: 500,
                bgcolor: `${accentColor}15`,
                color: accentColor,
                border: `1px solid ${accentColor}40`,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: `${accentColor}25`,
                  border: `1px solid ${accentColor}60`,
                },
                '& .MuiChip-label': {
                  whiteSpace: 'normal',
                  padding: '4px 8px',
                },
              }}
            />
          ))}
        </Box>
      )}

      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', mb: 1 }}>
        How are you feeling?
      </Typography>

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
              bgcolor: mood === m.emoji ? `${accentColor}33` : 'rgba(255,255,255,0.06)',
              color: mood === m.emoji ? accentColor : 'rgba(255,255,255,0.6)',
              border: mood === m.emoji ? `1px solid ${accentColor}66` : '1px solid transparent',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          />
        ))}
      </Box>

      {/* Note input */}
      <TextField
        fullWidth multiline minRows={3} maxRows={6}
        placeholder="What's on your mind?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        sx={{
          mb: 1,
          '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.04)', fontSize: '0.9rem' },
        }}
      />

      <Box sx={{ mb: 1.5 }}>
        <NoteAttachmentBar
          attachments={freeAttachments}
          onChange={setFreeAttachments}
          userId={user?.id || ''}
          accentColor={accentColor}
        />
      </Box>

      <Button
        fullWidth variant="contained"
        onClick={handleSaveJournal}
        disabled={saving || (!note.trim() && !mood)}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
        sx={{
          borderRadius: '14px', fontWeight: 800, py: 1.5, fontSize: '0.9rem',
          bgcolor: accentColor,
          color: '#0A0B14',
          '&:hover': { bgcolor: accentColor, filter: 'brightness(1.1)' },
          '&:disabled': { opacity: 0.4 },
        }}
      >
        {saving ? 'Saving...' : 'Save to Notebook'}
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
          borderRadius: '24px 24px 0 0',
          position: 'fixed',
          bottom: 0,
          m: 0,
          maxHeight: '95vh',
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
            <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
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
            <Box
              onClick={() => setViewMode('free')}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                p: '14px 16px', borderRadius: '16px', mb: 2,
                bgcolor: 'rgba(167,139,250,0.08)',
                border: '1px solid rgba(167,139,250,0.15)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'rgba(167,139,250,0.12)', borderColor: 'rgba(167,139,250,0.3)' },
              }}
            >
              <MenuBookIcon sx={{ fontSize: '1.4rem', color: '#A78BFA' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#F3F4F6' }}>
                  Free Note
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
                  Reflect without linking to a goal
                </Typography>
              </Box>
              <Chip label="📝" size="small" sx={{ bgcolor: 'rgba(167,139,250,0.1)', fontWeight: 800 }} />
            </Box>

            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', mb: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Topics
            </Typography>

            {goals.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', py: 2, textAlign: 'center' }}>
                No active topics yet.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {sortedGoals.map(goal => {
                  const color = domainColor(goal.domain);
                  const icon = DOMAIN_ICONS[goal.domain] || '🎯';
                  const pct = Math.round((goal.progress || 0) * 100);
                  // Count today's logs for this goal's domain trackers
                  const domainTrackerIds = DOMAIN_TRACKER_MAP[goal.domain] || [];
                  const domainLogCount = domainTrackerIds.reduce((sum, tid) => sum + (todayLogCounts[tid] || 0), 0);
                  return (
                    <Box
                      key={goal.id}
                      onClick={() => handleSelectGoal(goal)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: '12px 16px', borderRadius: '16px',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: `1px solid rgba(255,255,255,0.06)`,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: `${color}12`, borderColor: `${color}30` },
                      }}
                    >
                      <Typography sx={{ fontSize: '1.25rem' }}>{icon}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#F3F4F6' }} noWrap>
                          {goal.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                          {goal.domain}
                        </Typography>
                      </Box>
                      {domainLogCount > 0 && (
                        <Chip
                          label={`${domainLogCount} logged`}
                          size="small"
                          sx={{
                            fontSize: '0.6rem', fontWeight: 800, height: 22,
                            bgcolor: `${color}20`,
                            color,
                            border: `1px solid ${color}40`,
                          }}
                        />
                      )}
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 900, color }}>
                        {pct}%
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        ) : viewMode === 'free' ? (
          /* ── Free diary entry ──────── */
          <Box sx={{ pb: 3 }}>
            {renderJournalForm('#A78BFA')}
          </Box>
        ) : selectedGoal ? (
          /* ── Goal detail + trackers ──── */
          <Box sx={{ pb: 2 }}>
            {/* Quick journal at top */}
            {renderJournalForm(domainColor(selectedGoal.domain))}
            
            <Divider sx={{ my: 3, mx: 2.5, borderColor: 'rgba(255,255,255,0.06)' }} />

            {/* Goal detail and trackers below */}
            <Box>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', mb: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase', px: 2.5 }}>
                Trackers & Progress
              </Typography>
              <NoteGoalDetail
                node={toFrontendNode(selectedGoal)}
                allNodes={rawNodes}
                userId={user?.id || ''}
                activeBets={activeBets}
                onProgressUpdate={() => {}}
              />
            </Box>
          </Box>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default QuickLogDialog;
