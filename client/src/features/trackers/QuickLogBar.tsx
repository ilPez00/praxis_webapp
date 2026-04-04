/**
 * QuickLogBar — one-tap logging bar for the Dashboard.
 * Shows quick buttons for your active trackers. Tap to log instantly.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { TRACKER_MAP, TrackerType } from './trackerTypes';
import toast from 'react-hot-toast';
import { Box, IconButton, Typography, Chip, CircularProgress, Badge } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import api from '../../lib/api';

interface Tracker {
  id: string;
  type: string;
  goal: any;
}

interface QuickLogBarProps {
  userId: string;
}

const QUICK_TRACKERS = ['lift', 'cardio', 'meal', 'steps', 'study', 'meditation', 'sleep'];

const QuickLogBar: React.FC<QuickLogBarProps> = ({ userId }) => {
  const getLocation = useCurrentLocation();
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: trackerData } = await supabase
        .from('trackers')
        .select('id, type, goal')
        .eq('user_id', userId);

      if (trackerData && trackerData.length > 0) {
        setTrackers(trackerData);
        
        const today = new Date().toISOString().slice(0, 10);
        const { data: entries } = await supabase
          .from('tracker_entries')
          .select('tracker_id, logged_at')
          .eq('user_id', userId)
          .gte('logged_at', `${today}T00:00:00`);

        const counts: Record<string, number> = {};
        for (const e of entries || []) {
          counts[e.tracker_id] = (counts[e.tracker_id] || 0) + 1;
        }
        setTodayCounts(counts);

        // Calculate streaks per tracker type
        const typeIds = Object.fromEntries(trackerData.map(t => [t.id, t.type]));
        const typeEntries: Record<string, string[]> = {};
        
        const { data: allEntries } = await supabase
          .from('tracker_entries')
          .select('tracker_id, logged_at')
          .eq('user_id', userId)
          .order('logged_at', { ascending: false })
          .limit(100);

        for (const e of allEntries || []) {
          const type = typeIds[e.tracker_id];
          if (type) {
            if (!typeEntries[type]) typeEntries[type] = [];
            typeEntries[type].push(e.logged_at.slice(0, 10));
          }
        }

        const newStreaks: Record<string, number> = {};
        for (const [trackerId, type] of Object.entries(typeIds)) {
          const dates = [...new Set((typeEntries[type as string] || []) as string[])].sort().reverse();
          if (dates.length === 0) continue;
          
          let streak = 0;
          const todayStr = new Date().toISOString().slice(0, 10);
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          
          // Check if logged today or yesterday to start counting
          if (dates[0] === todayStr || dates[0] === yesterday) {
            streak = 1;
            for (let i = 1; i < dates.length; i++) {
              const prevDate = dates[i-1] as string;
              const currDate = dates[i] as string;
              const diff = (new Date(prevDate).getTime() - new Date(currDate).getTime()) / 86400000;
              if (diff === 1) {
                streak++;
              } else {
                break;
              }
            }
          }
          newStreaks[trackerId] = streak;
        }
        setStreaks(newStreaks);
      }
    } catch (err) {
      console.error('QuickLogBar load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId, loadData]);

  const handleQuickLog = async (tracker: Tracker) => {
    const def = TRACKER_MAP[tracker.type];
    if (!def) return;

    setLoggingId(tracker.id);
    try {
      const loc = getLocation();
      await api.post('/trackers/log', {
        type: tracker.type,
        data: { _quickLog: true, _timestamp: new Date().toISOString(), ...(loc && { _location: loc }) },
      });
      toast.success(`${def.icon} Logged!`);
      loadData();
    } catch (err: any) {
      toast.error('Failed to log');
    } finally {
      setLoggingId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (trackers.length === 0) {
    return null;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 1.5, 
      overflowX: 'auto', 
      py: 2,
      px: 1,
      mx: -1,
      '&::-webkit-scrollbar': { display: 'none' },
      scrollbarWidth: 'none',
    }}>
      {trackers.map(tracker => {
        const def = TRACKER_MAP[tracker.type];
        if (!def) return null;

        const count = todayCounts[tracker.id] ?? 0;
        const streak = streaks[tracker.id] ?? 0;
        const isLogging = loggingId === tracker.id;

        return (
          <Chip
            key={tracker.id}
            icon={
              isLogging ? (
                <CircularProgress size={14} sx={{ color: '#0A0B14' }} />
              ) : (
                <AddIcon sx={{ fontSize: '14px !important' }} />
              )
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{def.icon}</span>
                <span>{def.label}</span>
                {count > 0 && (
                  <Box component="span" sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)', 
                    borderRadius: '50%', 
                    width: 16, 
                    height: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}>
                    {count}
                  </Box>
                )}
                {streak > 2 && (
                  <Box component="span" sx={{ color: '#F59E0B', fontSize: '0.65rem' }}>🔥{streak}</Box>
                )}
              </Box>
            }
            onClick={() => !isLogging && handleQuickLog(tracker)}
            disabled={isLogging}
            sx={{
              bgcolor: def.bg,
              border: `1px solid ${def.border}`,
              color: def.color,
              fontWeight: 700,
              fontSize: '0.75rem',
              borderRadius: '12px',
              height: 32,
              '& .MuiChip-icon': {
                color: def.color,
                marginLeft: '6px',
              },
              '&:hover': {
                bgcolor: def.bg,
                borderColor: def.color,
                transform: 'scale(1.02)',
              },
              transition: 'all 0.15s ease',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
        );
      })}
    </Box>
  );
};

export default QuickLogBar;
