import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, CircularProgress, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GlassCard from '../../../components/common/GlassCard';
import api from '../../../lib/api';

interface WordFreq {
  word: string;
  count: number;
}

const CommonWordsWidget: React.FC = () => {
  const [words, setWords] = useState<WordFreq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWords = async () => {
      try {
        const res = await api.get('/words/user-frequency');
        setWords(res.data.words || []);
      } catch (err) {
        console.error('Failed to fetch user word frequency:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWords();
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={20} /></Box>;
  if (words.length === 0) return null;

  return (
    <GlassCard glowColor="rgba(139,92,246,0.1)" sx={{ p: 2.5, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 18 }} />
        <Typography variant="body1" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Your Mindset
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
          Most used "juicy" words in your goals & logs
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {words.map(({ word, count }) => {
          // Font size based on frequency
          const max = words[0]?.count || 1;
          const scale = count / max;
          const fontSize = 0.7 + (scale * 0.5); // 0.7rem to 1.2rem
          
          return (
            <Tooltip key={word} title={`Used ${count} times`} arrow>
              <Chip
                label={word}
                size="small"
                sx={{
                  bgcolor: `rgba(139,92,246,${0.05 + scale * 0.15})`,
                  color: scale > 0.6 ? 'primary.main' : 'text.primary',
                  fontWeight: scale > 0.5 ? 700 : 400,
                  fontSize: `${fontSize}rem`,
                  height: 'auto',
                  py: 0.5,
                  border: `1px solid rgba(139,92,246,${0.1 + scale * 0.2})`,
                  '&:hover': {
                    bgcolor: `rgba(139,92,246,0.25)`,
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.2s',
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </GlassCard>
  );
};

export default CommonWordsWidget;
