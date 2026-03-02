/**
 * TrackerWidget — compact tracker panel for the Dashboard.
 * Shows active trackers with today's entry count and a quick-log button.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { TRACKER_MAP, TrackerType } from './trackerTypes';
import GlassCard from '../../components/common/GlassCard';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

interface Tracker { id: string; type: string; }

interface TrackerWidgetProps {
  userId: string;
}

const TrackerWidget: React.FC<TrackerWidgetProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Log dialog
  const [logTracker, setLogTracker] = useState<(Tracker & { def: TrackerType }) | null>(null);
  const [logFields, setLogFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: eData } = await supabase
        .from('tracker_entries')
        .select('tracker_id')
        .in('tracker_id', ids)
        .gte('logged_at', today.toISOString());

      const counts: Record<string, number> = {};
      for (const e of (eData ?? [])) {
        counts[e.tracker_id] = (counts[e.tracker_id] ?? 0) + 1;
      }
      setTodayCounts(counts);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openLog = (tracker: Tracker) => {
    const def = TRACKER_MAP[tracker.type];
    if (!def) return;
    setLogTracker({ ...tracker, def });
    setLogFields({});
  };

  const saveEntry = async () => {
    if (!logTracker) return;
    const missing = logTracker.def.fields
      .filter(f => !f.optional && !logFields[f.key]?.trim())
      .map(f => f.label);
    if (missing.length > 0) { toast.error(`Fill in: ${missing.join(', ')}`); return; }
    setSaving(true);
    const { error } = await supabase.from('tracker_entries').insert({
      tracker_id: logTracker.id,
      user_id: userId,
      data: logFields,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Logged!');
    setLogTracker(null);
    loadData();
  };

  return (
    <GlassCard sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Trackers</Typography>
        <Button
          size="small"
          variant="text"
          onClick={() => navigate('/profile')}
          sx={{ fontSize: '0.75rem', color: 'text.secondary', borderRadius: '8px' }}
        >
          Manage
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : trackers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 1.5 }}>
            No trackers set up yet
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/profile')}
            variant="outlined"
            sx={{ borderRadius: '10px', fontSize: '0.78rem' }}
          >
            Set up trackers
          </Button>
        </Box>
      ) : (
        <Stack spacing={1}>
          {trackers.map(tracker => {
            const def = TRACKER_MAP[tracker.type];
            if (!def) return null;
            const count = todayCounts[tracker.id] ?? 0;
            return (
              <Box
                key={tracker.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${def.border}`,
                  bgcolor: def.bg,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>{def.icon}</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: def.color, lineHeight: 1.2 }}>
                      {def.label}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {count > 0 ? `${count} log${count > 1 ? 's' : ''} today` : 'Not logged today'}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  size="small"
                  onClick={() => openLog(tracker)}
                  sx={{
                    borderRadius: '8px',
                    minWidth: 0,
                    px: 1.5,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: def.color,
                    border: `1px solid ${def.border}`,
                    '&:hover': { bgcolor: def.bg, borderColor: def.color },
                  }}
                >
                  + Log
                </Button>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Log Entry Dialog */}
      <Dialog open={!!logTracker} onClose={() => setLogTracker(null)} maxWidth="xs" fullWidth>
        {logTracker && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '1.2rem' }}>{logTracker.def.icon}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{logTracker.def.label}</Typography>
                </Box>
                <IconButton size="small" onClick={() => setLogTracker(null)}><CloseIcon /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                {logTracker.def.fields.map(field => (
                  field.type === 'select' ? (
                    <TextField
                      key={field.key}
                      select
                      label={`${field.label}${field.optional ? ' (optional)' : ' *'}`}
                      value={logFields[field.key] ?? ''}
                      onChange={e => setLogFields(p => ({ ...p, [field.key]: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {field.options!.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  ) : (
                    <TextField
                      key={field.key}
                      label={`${field.label}${field.optional ? ' (optional)' : ' *'}`}
                      type={field.type}
                      value={logFields[field.key] ?? ''}
                      onChange={e => setLogFields(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      fullWidth
                      size="small"
                      inputProps={field.type === 'number' ? { min: 0, step: 'any' } : undefined}
                    />
                  )
                ))}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setLogTracker(null)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={saveEntry}
                disabled={saving}
                sx={{ borderRadius: '10px', fontWeight: 700, minWidth: 80 }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Log'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </GlassCard>
  );
};

export default TrackerWidget;
