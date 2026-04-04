/**
 * TrackerSuggestions - context-aware suggestions for logging.
 * Shows prompts based on time of day and user's tracker patterns.
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Chip } from '@mui/material';
import { TRACKER_MAP } from './trackerTypes';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface TrackerSuggestion {
  type: string;
  reason: string;
  icon: string;
}

interface TrackerSuggestionsProps {
  userId: string;
  onLog: (type: string) => void;
}

const TIME_SUGGESTIONS: Record<string, string[]> = {
  morning: ['meal', 'steps', 'meditation', 'study'],
  afternoon: ['lift', 'cardio', 'study', 'meal'],
  evening: ['meal', 'sleep', 'journal', 'meditation'],
  night: ['sleep', 'journal'],
};

const TrackerSuggestions: React.FC<TrackerSuggestionsProps> = ({ userId, onLog }) => {
  const [suggestions, setSuggestions] = useState<TrackerSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastLogged, setLastLogged] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSuggestions();
  }, [userId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const hour = new Date().getHours();
      let timeOfDay = 'afternoon';
      if (hour < 6) timeOfDay = 'night';
      else if (hour < 12) timeOfDay = 'morning';
      else if (hour < 18) timeOfDay = 'afternoon';
      else if (hour < 22) timeOfDay = 'evening';
      else timeOfDay = 'night';

      const preferredTypes = TIME_SUGGESTIONS[timeOfDay] || [];

      const { data: trackerData } = await api.get(`/trackers/${userId}`);
      const userTrackers = (trackerData || []).map((t: any) => t.type);
      
      const recommended: TrackerSuggestion[] = [];
      
      for (const type of preferredTypes) {
        if (userTrackers.includes(type)) {
          const def = TRACKER_MAP[type];
          if (def) {
            const lastLog = lastLogged[type];
            let reason = '';
            if (timeOfDay === 'morning') reason = 'Good way to start your day';
            else if (timeOfDay === 'afternoon') reason = 'Time to stay on track';
            else if (timeOfDay === 'evening') reason = 'Wind down activity';
            else reason = 'How did today go?';
            
            recommended.push({
              type,
              reason,
              icon: def.icon,
            });
          }
        }
      }

      setSuggestions(recommended.slice(0, 3));
    } catch (err) {
      console.error('Suggestions error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 1 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', py: 1 }}>
      <Typography variant="caption" color="text.disabled" sx={{ width: '100%', mb: 0.5 }}>
        Suggested:
      </Typography>
      {suggestions.map(s => (
        <Chip
          key={s.type}
          label={`${s.icon} Log ${TRACKER_MAP[s.type]?.label}`}
          onClick={() => onLog(s.type)}
          size="small"
          sx={{
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            fontSize: '0.7rem',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        />
      ))}
    </Box>
  );
};

export default TrackerSuggestions;
