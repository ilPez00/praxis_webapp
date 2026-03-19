/**
 * TrackerWidget — compact tracker panel for the Dashboard.
 * Shows active trackers with today's entry count and a quick-log button.
 * Supports offline logging with auto-sync.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/db';
import { TRACKER_MAP, DOMAIN_TRACKER_MAP, TrackerType } from './trackerTypes';
import EditableTrackerForm from './EditableTrackerForm';
import GlassCard from '../../components/common/GlassCard';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../lib/api';

interface Tracker { id: string; type: string; goal: any; }

interface TrackerWidgetProps {
  userId: string;
}

const TrackerWidget: React.FC<TrackerWidgetProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // New item dialog
  const [addItemTracker, setAddItemTracker] = useState<Tracker | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');

  // Log dialog (legacy/full mode)
  const [logTracker, setLogTracker] = useState<(Tracker & { def: TrackerType }) | null>(null);
  const [saving, setSaving] = useState(false);

  const [manageTrackerId, setManageTrackerId] = useState<string | null>(null);

  const handleRemoveLibraryItem = async (tracker: Tracker, itemIdx: number) => {
    const currentGoal = tracker.goal || {};
    const library = currentGoal.library || [];
    const newLibrary = library.filter((_: any, idx: number) => idx !== itemIdx);

    try {
      const { error } = await supabase
        .from('trackers')
        .update({ goal: { ...currentGoal, library: newLibrary } })
        .eq('id', tracker.id);

      if (error) throw error;
      toast.success('Removed from list');
      loadData();
    } catch (err: any) {
      toast.error('Failed to remove item');
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch user's goal domains
      const { data: treeData } = await supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .single();

      if (treeData?.nodes) {
        const nodes = treeData.nodes as any[];
        const domains = [...new Set(nodes.map(n => n.domain).filter(Boolean))];
        const trackerIdsToActivate = new Set<string>();
        domains.forEach(d => {
          const trackerIds = DOMAIN_TRACKER_MAP[d] ?? [];
          trackerIds.forEach(id => trackerIdsToActivate.add(id));
        });

        const { data: activeTrackers } = await supabase
          .from('trackers')
          .select('id, type')
          .eq('user_id', userId);

        const existingTypes = new Set(activeTrackers?.map(t => t.type) ?? []);
        const toCreate = [...trackerIdsToActivate].filter(id => !existingTypes.has(id));

        if (toCreate.length > 0) {
          const inserts = toCreate.map(type => ({ user_id: userId, type }));
          await supabase.from('trackers').insert(inserts);
        }
      }

      // 2. Fetch the active trackers with 'goal' column (where we store library)
      const { data: tData } = await supabase
        .from('trackers')
        .select('id, type, goal')
        .eq('user_id', userId);
      const activeTrackers: Tracker[] = tData ?? [];
      setTrackers(activeTrackers);

      // 3. Count today's entries
      if (activeTrackers.length > 0) {
        const ids = activeTrackers.map(t => t.id);
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().slice(0, 10);

        const { data: entries } = await supabase
          .from('tracker_entries')
          .select('tracker_id')
          .in('tracker_id', ids)
          .gte('logged_at', today)
          .lt('logged_at', tomorrowStr);

        const counts: Record<string, number> = {};
        entries?.forEach(e => {
          counts[e.tracker_id] = (counts[e.tracker_id] ?? 0) + 1;
        });

        const offlineEntries = await db.trackerEntries
          .where('logged_at')
          .between(today, tomorrowStr)
          .toArray();
        
        offlineEntries.forEach(e => {
          counts[e.tracker_id] = (counts[e.tracker_id] ?? 0) + 1;
        });

        setTodayCounts(counts);
      }
    } catch (err) {
      console.error('TrackerWidget: error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleQuickLog = async (tracker: Tracker, item: any) => {
    const logData = {
      items: [{
        name: item.name,
        value: 1,
        unit: item.unit || '',
      }]
    };
    
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      await axios.post(`${API_URL}/trackers/log`, {
        type: tracker.type,
        data: logData,
      }, { headers });

      toast.success(`Logged: ${item.name}`);
      loadData();
    } catch (err: any) {
      toast.error('Failed to log');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!addItemTracker || !newItemName.trim()) return;

    const currentGoal = addItemTracker.goal || {};
    const library = currentGoal.library || [];
    const newLibrary = [...library, { name: newItemName, unit: newItemUnit }];

    try {
      const { error } = await supabase
        .from('trackers')
        .update({ goal: { ...currentGoal, library: newLibrary } })
        .eq('id', addItemTracker.id);

      if (error) throw error;
      toast.success('Added to list');
      setAddItemTracker(null);
      setNewItemName('');
      setNewItemUnit('');
      loadData();
    } catch (err: any) {
      toast.error('Failed to add item');
    }
  };

  const openFullLog = (tracker: Tracker) => {
    const def = TRACKER_MAP[tracker.type];
    if (!def) return;
    setLogTracker({ ...tracker, def });
  };

  const saveEntry = async (data: any) => {
    if (!logTracker) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      await axios.post(`${API_URL}/trackers/log`, {
        type: logTracker.type,
        data: data,
      }, { headers });

      toast.success('Logged!');
      loadData();
    } catch (err: any) {
      toast.error('Failed to log');
    } finally {
      setSaving(false);
      setLogTracker(null);
    }
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
        <Stack spacing={2}>
          {trackers.map(tracker => {
            const def = TRACKER_MAP[tracker.type];
            if (!def) return null;
            const count = todayCounts[tracker.id] ?? 0;
            const library = tracker.goal?.library || [];
            const isManaging = manageTrackerId === tracker.id;

            return (
              <Box
                key={tracker.id}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: `1px solid ${def.border}`,
                  bgcolor: def.bg,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box 
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', flex: 1 }}
                    onClick={() => openFullLog(tracker)}
                  >
                    <Typography sx={{ fontSize: '1.2rem', lineHeight: 1 }}>{def.icon}</Typography>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: def.color, lineHeight: 1.2 }}>
                        {def.label}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {count > 0 ? `${count} entry today` : 'No logs yet'}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => openFullLog(tracker)}
                      sx={{ 
                        bgcolor: def.color, 
                        color: '#0D0E1A', 
                        fontSize: '0.65rem', 
                        fontWeight: 800,
                        minWidth: 0,
                        height: 24,
                        borderRadius: '6px',
                        '&:hover': { bgcolor: def.color, opacity: 0.9 }
                      }}
                    >
                      Full Log
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setManageTrackerId(isManaging ? null : tracker.id)}
                      sx={{ color: isManaging ? 'primary.main' : 'text.secondary', fontSize: '0.65rem', minWidth: 0 }}
                    >
                      {isManaging ? 'Done' : 'Edit List'}
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {library.map((item: any, idx: number) => (
                    <Button
                      key={idx}
                      size="small"
                      variant="outlined"
                      onClick={() => isManaging ? handleRemoveLibraryItem(tracker, idx) : handleQuickLog(tracker, item)}
                      disabled={saving}
                      startIcon={isManaging ? <RemoveIcon sx={{ fontSize: '12px !important' }} /> : undefined}
                      sx={{
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderColor: isManaging ? 'error.main' : def.border,
                        color: isManaging ? 'error.main' : def.color,
                        '&:hover': { 
                          bgcolor: isManaging ? 'rgba(239,68,68,0.1)' : def.bg, 
                          borderColor: isManaging ? 'error.light' : def.color 
                        }
                      }}
                    >
                      {item.name}
                    </Button>
                  ))}
                  {!isManaging && (
                    <IconButton
                      size="small"
                      onClick={() => setAddItemTracker(tracker)}
                      sx={{ 
                        borderRadius: '10px', 
                        border: '1px dashed', 
                        borderColor: 'rgba(255,255,255,0.2)',
                        color: 'text.secondary'
                      }}
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}

      {/* Simplified Add Item Dialog */}
      <Dialog open={!!addItemTracker} onClose={() => setAddItemTracker(null)} PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Add Trackable Item</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            What do you want to enumerate for this tracker?
          </Typography>
          <Stack spacing={2}>
            <TextField
              autoFocus
              label="Item Name"
              placeholder="e.g. Coffee, Pushups, Protein"
              fullWidth
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
            />
            <TextField
              label="Unit (optional)"
              placeholder="e.g. cup, reps, g"
              fullWidth
              value={newItemUnit}
              onChange={e => setNewItemUnit(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAddItemTracker(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddItem} disabled={!newItemName.trim()} sx={{ borderRadius: '10px' }}>
            Add to List
          </Button>
        </DialogActions>
      </Dialog>

      {/* Legacy/Full Log Dialog */}
      <EditableTrackerForm
        open={!!logTracker}
        onClose={() => setLogTracker(null)}
        tracker={logTracker}
        onSave={saveEntry}
        saving={saving}
      />
    </GlassCard>
  );
};

export default TrackerWidget;
