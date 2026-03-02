/**
 * AICoachPage — Master Roshi AI coaching interface.
 *
 * Load order:
 *  1. GET /ai-coaching/brief   — instant cached brief (no spinner if exists)
 *  2. POST /ai-coaching/trigger — fire-and-forget background refresh (rate-limited 30 min)
 *  3. Supabase realtime on coaching_briefs — auto-updates UI when background job completes
 *
 * If no cached brief exists, falls back to generating one inline via POST /report.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS } from '../../types/goal';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  LinearProgress,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagIcon from '@mui/icons-material/Flag';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface StrategyItem {
  goal: string;
  domain: string;
  progress: number;
  insight: string;
  steps: string[];
}

interface CoachingReport {
  motivation: string;
  strategy: StrategyItem[];
  network: string;
}

interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── component ─────────────────────────────────────────────────────────────────

const AICoachPage: React.FC = () => {
  const [report, setReport] = useState<CoachingReport | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── load cached brief ─────────────────────────────────────────────────────

  const loadCachedBrief = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/ai-coaching/brief`, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<{ brief: CoachingReport; generated_at: string } | null>;
  }, []);

  // ── generate fresh brief (inline, blocking) ───────────────────────────────

  const generateBrief = useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/ai-coaching/report`, { method: 'POST', headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Error ${res.status}`);
      }
      const data: CoachingReport = await res.json();
      setReport(data);
      setGeneratedAt(new Date().toISOString());
    } catch (err: any) {
      setReportError(err.message || 'Failed to generate coaching report.');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  // ── fire background trigger (rate-limited on backend) ────────────────────

  const triggerBackgroundUpdate = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/ai-coaching/trigger`, { method: 'POST', headers });
    } catch {
      // silently ignore — non-critical
    }
  }, []);

  // ── manual refresh button ─────────────────────────────────────────────────

  const handleRefresh = async () => {
    setRefreshing(true);
    await generateBrief();
    setRefreshing(false);
  };

  // ── initialise ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Try cache first — instant display
      const cached = await loadCachedBrief();
      if (!cancelled && cached) {
        setReport(cached.brief);
        setGeneratedAt(cached.generated_at);
        setLoadingReport(false);
        // 2. Kick off background refresh in parallel
        triggerBackgroundUpdate();
        return;
      }

      // 3. No cache — generate inline
      if (!cancelled) await generateBrief();
    })();

    return () => { cancelled = true; };
  }, [loadCachedBrief, generateBrief, triggerBackgroundUpdate]);

  // ── Supabase realtime — auto-refresh when background job finishes ─────────

  useEffect(() => {
    let userId: string | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      userId = session?.user?.id ?? null;
      if (!userId) return;

      const channel = supabase
        .channel('coaching_briefs_updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'coaching_briefs', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as { brief: CoachingReport; generated_at: string } | null;
            if (row?.brief) {
              setReport(row.brief);
              setGeneratedAt(row.generated_at);
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, []);

  // ── chat scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // ── follow-up Q&A ─────────────────────────────────────────────────────────

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setQuestion('');
    setAsking(true);
    setChat(prev => [...prev, { role: 'user', text: q }]);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/ai-coaching/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userPrompt: q }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Error ${res.status}`);
      }
      const { response } = await res.json();
      setChat(prev => [...prev, { role: 'coach', text: response }]);
    } catch (err: any) {
      setChat(prev => [...prev, { role: 'coach', text: `Sorry, something went wrong: ${err.message}` }]);
    } finally {
      setAsking(false);
    }
  };

  // ── UI helpers ────────────────────────────────────────────────────────────

  const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; color?: string }> = ({ icon, label, color = 'primary.main' }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Box sx={{ color }}>{icon}</Box>
      <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color }}>{label}</Typography>
    </Box>
  );

  // ── loading ───────────────────────────────────────────────────────────────

  if (loadingReport) {
    return (
      <Container maxWidth="md" sx={{ mt: 6, textAlign: 'center' }}>
        <Box sx={{ mb: 3 }}>
          <Avatar sx={{
            width: 64, height: 64, mx: 'auto', mb: 2,
            background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
            border: '3px solid rgba(245,158,11,0.5)',
            fontSize: '2rem',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            🥋
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Master Roshi is thinking…</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Reviewing your goals, progress, and network.
          </Typography>
          <LinearProgress sx={{ borderRadius: 2, height: 6, maxWidth: 320, mx: 'auto' }} />
        </Box>
      </Container>
    );
  }

  if (reportError) {
    return (
      <Container maxWidth="md" sx={{ mt: 6 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{reportError}</Alert>
        <Button variant="contained" startIcon={<RefreshIcon />} onClick={handleRefresh}>Retry</Button>
      </Container>
    );
  }

  if (!report) return null;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="md" sx={{ mt: 4, pb: 8 }}>

      {/* Page header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
            border: '2px solid rgba(245,158,11,0.45)',
            fontSize: '1.5rem',
          }}>
            🥋
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>Master Roshi</Typography>
            {generatedAt && (
              <Typography variant="caption" color="text.disabled">
                Updated {formatAge(generatedAt)} · auto-refreshes when you post or edit your profile
              </Typography>
            )}
          </Box>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
          sx={{ borderRadius: '10px' }}
        >
          Refresh
        </Button>
      </Box>

      <Stack spacing={3}>

        {/* ── Section 1: Motivation ──────────────────────────────────── */}
        <Box sx={{
          p: 3, borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(139,92,246,0.06) 100%)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}>
          <SectionHeader icon={<Box sx={{ fontSize: '1.1rem' }}>🥋</Box>} label="Roshi's Take" />
          <Typography variant="body1" sx={{ lineHeight: 1.9, color: 'text.primary' }}>
            {report.motivation}
          </Typography>
        </Box>

        {/* ── Section 2: Strategy per goal ──────────────────────────── */}
        <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <SectionHeader icon={<FlagIcon />} label="Goal Strategy" color="#10B981" />
          <Stack spacing={1.5}>
            {(report.strategy ?? []).map((item, i) => {
              const color = DOMAIN_COLORS[item.domain] || '#9CA3AF';
              return (
                <Accordion
                  key={i}
                  disableGutters
                  elevation={0}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${color}33`,
                    borderRadius: '12px !important',
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { borderColor: `${color}66` },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                    sx={{ px: 2, py: 1, minHeight: 56 }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1, minWidth: 0, mr: 1 }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{item.goal}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip label={item.domain} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${color}18`, color, border: `1px solid ${color}44` }} />
                          <Typography variant="caption" color="text.disabled">{item.progress}% complete</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ width: 80, flexShrink: 0 }}>
                        <LinearProgress
                          variant="determinate"
                          value={item.progress}
                          sx={{ height: 6, borderRadius: 3, bgcolor: `${color}22`, '& .MuiLinearProgress-bar': { bgcolor: color } }}
                        />
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontStyle: 'italic' }}>
                      {item.insight}
                    </Typography>
                    <Stack spacing={1}>
                      {(item.steps ?? []).map((step, j) => (
                        <Box key={j} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                          <CheckCircleOutlineIcon sx={{ fontSize: 18, color, mt: 0.15, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{step}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              );
            })}
            {(report.strategy ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No goals yet — set up your goal tree and Roshi will map a strategy for each one.
              </Typography>
            )}
          </Stack>
        </Box>

        {/* ── Section 3: Network leverage ──────────────────────────── */}
        <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <SectionHeader icon={<PeopleIcon />} label="Network Leverage" color="#8B5CF6" />
          <Typography variant="body1" sx={{ lineHeight: 1.8, color: 'text.primary' }}>
            {report.network}
          </Typography>
        </Box>

        {/* ── Follow-up Q&A ────────────────────────────────────────── */}
        <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <SectionHeader icon={<Box sx={{ fontSize: '1rem' }}>🥋</Box>} label="Ask Roshi" />

          {chat.length > 0 && (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {chat.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                    {!isUser && (
                      <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #78350F, #92400E)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '1rem' }}>
                        🥋
                      </Avatar>
                    )}
                    <Box sx={{
                      maxWidth: '80%',
                      px: 2, py: 1.5,
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isUser
                        ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                        : 'rgba(255,255,255,0.06)',
                      border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <Typography variant="body2" sx={{ color: isUser ? '#0A0B14' : 'text.primary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {msg.text}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
              {asking && (
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #78350F, #92400E)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '1rem' }}>
                    🥋
                  </Avatar>
                  <Box sx={{ px: 2, py: 1.5, borderRadius: '16px 16px 16px 4px', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <CircularProgress size={16} sx={{ color: 'primary.main' }} />
                  </Box>
                </Box>
              )}
              <div ref={chatEndRef} />
            </Stack>
          )}

          {chat.length === 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: 'block' }}>
                Ask anything — planning, strategy, accountability, mindset
              </Typography>
              <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                {[
                  'Plan my week around my top goal',
                  'What should I focus on first?',
                  'How do I build a better routine?',
                  'Who in my network can help me?',
                ].map(q => (
                  <Chip
                    key={q}
                    label={q}
                    size="small"
                    onClick={() => setQuestion(q)}
                    sx={{ cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(245,158,11,0.1)', borderColor: 'primary.main' } }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Ask Roshi anything…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.04)' } }}
            />
            <IconButton
              onClick={handleAsk}
              disabled={!question.trim() || asking}
              sx={{
                bgcolor: 'primary.main', color: '#0A0B14', borderRadius: '12px', p: 1.25,
                '&:hover': { bgcolor: 'primary.light' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.disabled' },
              }}
            >
              {asking ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

      </Stack>
    </Container>
  );
};

export default AICoachPage;
