/**
 * TrackerWidget — simplified tracker widget for the Dashboard.
 * One-tap quick log buttons.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';

interface Tracker { id: string; type: string; goal: any; }

interface TrackerWidgetProps {
  userId: string;
}

const TrackerWidget: React.FC<TrackerWidgetProps> = ({ userId }) => {
  const navigate = useNavigate();
  const getLocation = useCurrentLocation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Add item dialog
  const [addItemTracker, setAddItemTracker] = useState<Tracker | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');

  // Log dialog
  const [logTracker, setLogTracker] = useState<(Tracker & { def: TrackerType }) | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
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

      const { data: tData } = await supabase
        .from('trackers')
        .select('id, type, goal')
        .eq('user_id', userId);
      const activeTrackers: Tracker[] = tData ?? [];
      setTrackers(activeTrackers);

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
        setTodayCounts(counts);
      }
    } catch (err) {
      console.error('TrackerWidget load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQuickLog = async (tracker: Tracker, data?: any) => {
    setSaving(true);
    try {
      if (!data || Object.keys(data).length === 0) {
        toast.error('No data to log');
        return;
      }
      const loc = getLocation();
      const res = await api.post('/trackers/log', {
        type: tracker.type,
        data: { ...data, ...(loc && { _location: loc }) },
      });
      if (res.data?.limitReached) {
        toast('Daily logging limit reached', { icon: '⚠️' });
      } else {
        toast.success('Logged!');
        loadData();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to log';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!addItemTracker || !newItemName.trim()) return;
    try {
      const currentGoal = addItemTracker.goal || {};
      const library = currentGoal.library || [];
      library.push({ name: newItemName.trim(), unit: newItemUnit.trim() });

      const { error } = await supabase
        .from('trackers')
        .update({ goal: { ...currentGoal, library } })
        .eq('id', addItemTracker.id);

      if (error) throw error;
      toast.success('Added');
      setAddItemTracker(null);
      setNewItemName('');
      setNewItemUnit('');
      loadData();
    } catch (err: any) {
      toast.error('Failed');
    }
  };

  const openFullLog = (tracker: Tracker) => {
    const def = TRACKER_MAP[tracker.type];
    if (!def) return;
    setLogTracker({ ...tracker, def });
  };

  const saveEntry = async (data: any) => {
    if (!logTracker) return;
    await handleQuickLog(logTracker, data);
    setLogTracker(null);
  };

  return (
    <GlassCard sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Quick Track</Typography>
        <Button
          size="small"
          variant="text"
          onClick={() => navigate('/profile')}
          sx={{ fontSize: '0.7rem', color: 'text.secondary', borderRadius: '6px' }}
        >
          More
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={18} />
        </Box>
      ) : trackers.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No trackers yet
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {trackers.map(tracker => {
            const def = TRACKER_MAP[tracker.type];
            if (!def) return null;
            const count = todayCounts[tracker.id] ?? 0;

            return (
              <Button
                key={tracker.id}
                size="small"
                variant="contained"
                onClick={() => handleQuickLog(tracker)}
                disabled={saving}
                startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                sx={{
                  bgcolor: def.bg,
                  color: def.color,
                  border: `1px solid ${def.border}`,
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  px: 1.5,
                  height: 28,
                  '& .MuiButton-startIcon': { mr: 0.5 },
                  '&:hover': { bgcolor: def.bg, borderColor: def.color },
                }}
              >
                {def.icon} {count > 0 && `(${count})`}
              </Button>
            );
          })}
        </Box>
      )}

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
