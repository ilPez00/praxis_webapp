import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Box, Typography, CircularProgress, Tabs, Tab,
  Paper, LinearProgress,
} from '@mui/material';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { DOMAIN_COLORS } from '../../types/goal';

// ── Types ──────────────────────────────────────────────────────────────────────

interface WordEntry {
  word: string;
  count: number;
}

interface WordsData {
  words: WordEntry[];
  byDomain: Record<string, Record<string, number>>;
}

// ── Auth helper ────────────────────────────────────────────────────────────────

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

// ── Color palette for word cloud ───────────────────────────────────────────────

const ACCENT_COLORS = [
  '#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA',
  '#6EE7B7', '#FCD34D', '#FB923C', '#E879F9', '#38BDF8',
];

// ── Main component ─────────────────────────────────────────────────────────────

const WordsPage: React.FC = () => {
  const { user } = useUser();
  const [data, setData] = useState<WordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainTab, setDomainTab] = useState(0); // 0 = All

  const fetchWords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`${API_URL}/words/frequency`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError('Failed to load word frequency data.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchWords();
  }, [user, fetchWords]);

  if (!user) return null;

  // ── Derive display data ────────────────────────────────────────────────────

  const domains = data ? Object.keys(data.byDomain).sort() : [];
  const allDomainTabs = ['All', ...domains];
  const selectedDomain = domainTab === 0 ? null : allDomainTabs[domainTab];

  // Words to display
  let displayWords: WordEntry[] = [];
  if (data) {
    if (selectedDomain && data.byDomain[selectedDomain]) {
      displayWords = Object.entries(data.byDomain[selectedDomain])
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 100);
    } else {
      displayWords = data.words;
    }
  }

  const maxCount = displayWords.length > 0 ? Math.max(...displayWords.map(w => w.count), 1) : 1;
  const fontSize = (count: number) => 12 + Math.round((count / maxCount) * 36); // 12–48px

  // Top 15 for bar chart
  const top15 = displayWords.slice(0, 15);
  const barMax = top15.length > 0 ? Math.max(...top15.map(w => w.count), 1) : 1;

  // Word color: try to find which domain uses this word most
  const wordColor = (word: string): string => {
    if (!data) return ACCENT_COLORS[0];
    let bestDomain = '';
    let bestCount = 0;
    for (const [domain, freq] of Object.entries(data.byDomain)) {
      const c = freq[word] ?? 0;
      if (c > bestCount) { bestCount = c; bestDomain = domain; }
    }
    if (bestDomain && (DOMAIN_COLORS as Record<string, string>)[bestDomain]) {
      return (DOMAIN_COLORS as Record<string, string>)[bestDomain];
    }
    // Fallback: cycle through accent colors by word hash
    const hash = word.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return ACCENT_COLORS[hash % ACCENT_COLORS.length];
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)' }}>
          <TextFieldsIcon sx={{ fontSize: 26, color: '#A78BFA', display: 'block' }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Goal Language</Typography>
          <Typography variant="body2" color="text.secondary">
            The most common words Praxis users use to describe their goals
          </Typography>
        </Box>
      </Box>

      {/* Domain filter tabs */}
      {!loading && data && domains.length > 0 && (
        <Tabs
          value={domainTab}
          onChange={(_, v) => setDomainTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mb: 3,
            mt: 2,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            '& .MuiTab-root': { fontWeight: 600, fontSize: '0.8rem', minWidth: 80 },
          }}
        >
          {allDomainTabs.map((d) => (
            <Tab key={d} label={d} />
          ))}
        </Tabs>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
          <TextFieldsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">{error}</Typography>
        </Box>
      ) : displayWords.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
          <TextFieldsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">No goal data yet. Add some goals to see word frequency.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start' }}>

          {/* ── Left: Word Cloud ─────────────────────────────────────────────── */}
          <Paper
            sx={{
              flex: '1 1 55%',
              minWidth: 0,
              p: 3,
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
              Word Cloud
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 320,
              }}
            >
              {displayWords.map(({ word, count }) => {
                const color = wordColor(word);
                const fs = fontSize(count);
                return (
                  <Typography
                    key={word}
                    component="span"
                    sx={{
                      fontSize: `${fs}px`,
                      fontWeight: fs > 24 ? 800 : fs > 16 ? 700 : 600,
                      color,
                      opacity: 0.75 + (count / maxCount) * 0.25,
                      lineHeight: 1.15,
                      cursor: 'default',
                      transition: 'opacity 0.15s ease',
                      '&:hover': { opacity: 1 },
                      userSelect: 'none',
                    }}
                    title={`${word}: ${count}`}
                  >
                    {word}
                  </Typography>
                );
              })}
            </Box>
          </Paper>

          {/* ── Right: Top 15 bar chart ──────────────────────────────────────── */}
          <Paper
            sx={{
              flex: '1 1 40%',
              minWidth: 0,
              p: 3,
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.72rem' }}>
              Top 15 Words
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {top15.map(({ word, count }, idx) => {
                const color = wordColor(word);
                const pct = Math.round((count / barMax) * 100);
                return (
                  <Box key={word}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.disabled', minWidth: 18, fontWeight: 600, fontSize: '0.68rem' }}
                        >
                          {idx + 1}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, color, fontSize: '0.875rem' }}
                        >
                          {word}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                        {count}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 5,
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: color,
                          borderRadius: 4,
                          opacity: 0.8,
                        },
                      }}
                    />
                  </Box>
                );
              })}
            </Box>

            {/* Summary */}
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" color="text.disabled">
                {displayWords.length} unique words across {selectedDomain ? `${selectedDomain} goals` : 'all goals'}
                {data && ` · ${domains.length} domains tracked`}
              </Typography>
            </Box>
          </Paper>
        </Box>
      )}
    </Container>
  );
};

export default WordsPage;
