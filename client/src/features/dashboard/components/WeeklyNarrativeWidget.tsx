import React, { useState } from 'react';
import { Box, Typography, Button, Chip, Stack, CircularProgress, Collapse } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import RefreshIcon from '@mui/icons-material/Refresh';
import GlassCard from '../../../components/common/GlassCard';
import api from '../../../lib/api';

interface Props {
  userId: string;
}

const WeeklyNarrativeWidget: React.FC<Props> = ({ userId: _userId }) => {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<{ narrative: string; generatedAt: string }>(
        '/ai-coaching/weekly-narrative',
      );
      setNarrative(data.narrative);
      setGeneratedAt(data.generatedAt);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to generate narrative. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <GlassCard sx={{
      p: 3,
      borderRadius: '20px',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(16,185,129,0.05) 100%)',
      border: '1px solid rgba(99,102,241,0.22)',
    }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <AutoStoriesIcon sx={{ color: '#6366F1', fontSize: 22 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 800, flexGrow: 1 }}>
          Weekly AI Recap
        </Typography>
        <Chip
          label="AI Coach"
          size="small"
          sx={{
            bgcolor: 'rgba(99,102,241,0.12)',
            color: '#6366F1',
            border: '1px solid rgba(99,102,241,0.3)',
            fontWeight: 700,
            fontSize: '0.65rem',
          }}
        />
      </Stack>

      {/* Body */}
      {!narrative && !loading && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
            Get a personalised narrative of your week — your journal entries, check-in wins, and streaks
            woven into a coaching story by your AI advisor.
          </Typography>
          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1.5 }}>
              {error}
            </Typography>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<AutoStoriesIcon />}
            onClick={generate}
            sx={{
              borderRadius: '10px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              '&:hover': { background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' },
            }}
          >
            Generate This Week's Story
          </Button>
        </Box>
      )}

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
          <CircularProgress size={22} sx={{ color: '#6366F1' }} />
          <Typography variant="body2" color="text.secondary">
            Your coach is reading your week…
          </Typography>
        </Box>
      )}

      <Collapse in={!!narrative && !loading}>
        {narrative && (
          <Box>
            {/* Narrative text */}
            <Typography
              variant="body2"
              color="text.primary"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.75,
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.85)',
                mb: 2,
              }}
            >
              {narrative}
            </Typography>

            {/* Footer */}
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              {generatedAt && (
                <Typography variant="caption" color="text.disabled">
                  Generated {formatDate(generatedAt)}
                </Typography>
              )}
              <Button
                size="small"
                startIcon={loading ? <CircularProgress size={12} color="inherit" /> : <RefreshIcon />}
                onClick={generate}
                disabled={loading}
                sx={{ color: '#6366F1', fontWeight: 700, fontSize: '0.7rem' }}
              >
                Regenerate
              </Button>
            </Stack>
          </Box>
        )}
      </Collapse>
    </GlassCard>
  );
};

export default WeeklyNarrativeWidget;
