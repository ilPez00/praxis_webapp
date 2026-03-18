/**
 * TrackerSection — full tracker UI for the profile page.
 * Only shown on the user's own profile.
 * Lets users activate/deactivate tracker types and log entries.
 */

import React, { useState, useEffect, useCallback } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { TRACKER_TYPES, TRACKER_MAP, TrackerType } from './trackerTypes';
import EditableTrackerForm from './EditableTrackerForm';
import GlassCard from '../../components/common/GlassCard';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

interface Tracker {
  id: string;
  type: string;
}

interface TrackerEntry {
  id: string;
  tracker_id: string;
  data: any;
  logged_at: string;
}

interface TrackerSectionProps {
  userId: string;
  /** When set, only show trackers whose type is in this list */
  filterTypes?: string[];
  /** When set, auto-opens the log dialog for this tracker type */
  initialLogType?: string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

const TrackerSection: React.FC<TrackerSectionProps> = ({ userId, filterTypes, initialLogType }) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<Record<string, TrackerEntry[]>>({});
  const [loading, setLoading] = useState(true);

  // "Add tracker" dialog
  const [addOpen, setAddOpen] = useState(false);

  // "Log entry" dialog state
  const [logTracker, setLogTracker] = useState<(Tracker & { def: TrackerType }) | null>(null);
  const [saving, setSaving] = useState(false);

  // ── data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: tData } = await supabase
      .from('trackers')
      .select('id, type')
      .eq('user_id', userId)
      .order('created_at');

    const activeTrackers: Tracker[] = tData ?? [];
    setTrackers(activeTrackers);

    if (activeTrackers.length > 0) {
      const ids = activeTrackers.map(t => t.id);
      const { data: eData } = await supabase
        .from('tracker_entries')
        .select('id, tracker_id, data, logged_at')
        .in('tracker_id', ids)
        .order('logged_at', { ascending: false });

      const grouped: Record<string, TrackerEntry[]> = {};
      for (const e of (eData ?? [])) {
        if (!grouped[e.tracker_id]) grouped[e.tracker_id] = [];
        if (grouped[e.tracker_id].length < 5) grouped[e.tracker_id].push(e);
      }
      setEntries(grouped);
    } else {
      setEntries({});
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-open log dialog when initialLogType is set
  useEffect(() => {
    if (!initialLogType || loading || trackers.length === 0) return;
    const tracker = trackers.find(t => t.type === initialLogType);
    if (tracker) {
      const def = TRACKER_MAP[tracker.type];
      if (def) {
        setLogTracker({ ...tracker, def });
      }
    }
  }, [initialLogType, loading, trackers]);

  // ── activate tracker ────────────────────────────────────────────────────────

  const activateTracker = async (typeId: string) => {
    const { error } = await supabase
      .from('trackers')
      .insert({ user_id: userId, type: typeId });
    if (error) { toast.error(error.message); return; }
    setAddOpen(false);
    loadData();
  };

  // ── remove tracker ──────────────────────────────────────────────────────────

  const removeTracker = async (trackerId: string) => {
    const { error } = await supabase.from('trackers').delete().eq('id', trackerId);
    if (error) { toast.error(error.message); return; }
    loadData();
  };

  // ── delete entry ────────────────────────────────────────────────────────────

  const deleteEntry = async (entryId: string) => {
    await supabase.from('tracker_entries').delete().eq('id', entryId);
    loadData();
  };

  // ── open log dialog ─────────────────────────────────────────────────────────

  const openLog = (tracker: Tracker) => {
    const def = TRACKER_MAP[tracker.type];
    if (!def) return;
    setLogTracker({ ...tracker, def });
  };

  // ── save log entry ──────────────────────────────────────────────────────────

  const saveEntry = async (data: any) => {
    if (!logTracker) return;
    setSaving(true);
    const { error } = await supabase.from('tracker_entries').insert({
      tracker_id: logTracker.id,
      user_id: userId,
      data: data,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Logged!');
    setLogTracker(null);
    loadData();
    // Tracker log counts as a check-in (fire-and-forget)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      fetch(`${API_URL}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
    });
  };

  // ── already-active type ids ─────────────────────────────────────────────────

  const activeTypeIds = new Set(trackers.map(t => t.type));
  const filterSet = filterTypes ? new Set(filterTypes) : null;
  const visibleTrackers = filterSet
    ? trackers.filter(t => filterSet.has(t.type))
    : trackers;
  const available = TRACKER_TYPES.filter(t =>
    !activeTypeIds.has(t.id) && (!filterSet || filterSet.has(t.id))
  );

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress size={24} />
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Trackers</Typography>
          {visibleTrackers.filter(t => t.type !== 'progress').length > 0 && (
            <Chip label={visibleTrackers.filter(t => t.type !== 'progress').length} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(255,255,255,0.08)' }} />
          )}
        </Box>
        {available.length > 0 && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ borderRadius: '10px', fontWeight: 600 }}
          >
            Add Tracker
          </Button>
        )}
      </Box>

      {visibleTrackers.length === 0 ? (
        <Box
          sx={{
            border: '2px dashed rgba(255,255,255,0.1)',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { borderColor: 'rgba(245,158,11,0.3)', bgcolor: 'rgba(245,158,11,0.03)' },
            transition: 'all 0.2s',
          }}
          onClick={() => setAddOpen(true)}
        >
          <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>No trackers yet</Typography>
          <Button size="small" startIcon={<AddCircleOutlineIcon />} sx={{ borderRadius: '10px' }}>
            Add your first tracker
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {visibleTrackers.filter(t => t.type !== 'progress').map(tracker => {
            const def = TRACKER_MAP[tracker.type];
            if (!def) return null;
            const trackerEntries = entries[tracker.id] ?? [];
            return (
              <GlassCard
                key={tracker.id}
                sx={{
                  p: 2.5,
                  border: `1px solid ${def.border}`,
                  bgcolor: def.bg,
                  borderRadius: '16px',
                }}
              >
                {/* Tracker header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>{def.icon}</Typography>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: def.color }}>{def.label}</Typography>
                      <Typography variant="caption" color="text.disabled">{def.description}</Typography>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openLog(tracker)}
                      sx={{
                        borderRadius: '8px',
                        borderColor: def.border,
                        color: def.color,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        '&:hover': { borderColor: def.color, bgcolor: def.bg },
                      }}
                    >
                      + Log
                    </Button>
                    <Tooltip title="Remove tracker">
                      <IconButton
                        size="small"
                        onClick={() => removeTracker(tracker.id)}
                        sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                {/* Recent entries */}
                {trackerEntries.length > 0 ? (
                  <Stack spacing={0.5}>
                    {trackerEntries.map((entry, i) => (
                      <Box key={entry.id}>
                        {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 0.5 }} />}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.82rem' }}>
                              {def.entryLabel(entry.data)}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {new Date(entry.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => deleteEntry(entry.id)}
                            sx={{ color: 'transparent', '&:hover': { color: 'text.disabled' } }}
                          >
                            <CloseIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.disabled">No entries yet — hit + Log to start</Typography>
                )}
              </GlassCard>
            );
          })}
        </Stack>
      )}

      {/* ── Add Tracker Dialog ─────────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Add a Tracker</Typography>
            <IconButton size="small" onClick={() => setAddOpen(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            {available.map(t => (
              <Box
                key={t.id}
                onClick={() => activateTracker(t.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${t.border}`,
                  bgcolor: t.bg,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: t.color, transform: 'translateX(4px)' },
                }}
              >
                <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{t.icon}</Typography>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: t.color }}>{t.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                </Box>
              </Box>
            ))}
            {available.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                All trackers are active!
              </Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* ── Log Entry Dialog (Now unified via EditableTrackerForm) ─────── */}
      <EditableTrackerForm
        open={!!logTracker}
        onClose={() => setLogTracker(null)}
        tracker={logTracker}
        onSave={saveEntry}
        saving={saving}
      />
    </Box>
  );
};

export default TrackerSection;

export default TrackerSection;
