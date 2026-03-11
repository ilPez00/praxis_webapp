import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import GlassCard from '../../components/common/GlassCard';
import UpgradeModal from '../../components/UpgradeModal';

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
  Grid,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagIcon from '@mui/icons-material/Flag';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockIcon from '@mui/icons-material/Lock';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

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

interface DailyRecommendation {
  match: { id: string; name: string; reason: string };
  event: { id: string; title: string; reason: string };
  place: { id: string; name: string; reason: string };
  challenge: { type: 'bet' | 'duel'; target: string; terms: string };
  resources: Array<{ goal: string; suggestion: string; details: string }>;
  routine: Array<{ time: string; task: string; alignment: string }>;
}

interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
}

// ── component ─────────────────────────────────────────────────────────────────

const AICoachPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [report, setReport] = useState<CoachingReport | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [dailyBrief, setDailyBrief] = useState<DailyRecommendation | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    };
  };

  const loadCachedBrief = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/ai-coaching/brief`, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<{ brief: CoachingReport; generated_at: string } | null>;
  }, []);

  const loadDailyBrief = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/ai-coaching/daily-brief`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.brief) setDailyBrief(data.brief);
      }
    } catch { /* ignore */ } finally {
      setLoadingDaily(false);
    }
  }, []);

  const generateBrief = useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);
    setDetailedError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/ai-coaching/report`, { method: 'POST', headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailedError(body.detailed || null);
        throw new Error(body.message || `Error ${res.status}`);
      }
      setReport(body);
      setGeneratedAt(new Date().toISOString());
    } catch (err: any) {
      setReportError(err.message || 'Failed to generate coaching report.');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  const triggerBackgroundUpdate = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/ai-coaching/trigger`, { method: 'POST', headers });
    } catch { /* ignore */ }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await generateBrief();
    setRefreshing(false);
  };

  useEffect(() => {
    let cancelled = false;
    loadDailyBrief();
    (async () => {
      try {
        const cached = await loadCachedBrief();
        if (!cancelled && cached) {
          setReport(cached.brief);
          setGeneratedAt(cached.generated_at);
        }
      } catch (err) {
        console.error('Cache load error:', err);
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadCachedBrief, loadDailyBrief]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detailed ? `${body.message} (${body.detailed})` : (body.message || `Error ${res.status}`));
      }
      setChat(prev => [...prev, { role: 'coach', text: body.response }]);
      triggerBackgroundUpdate();
    } catch (err: any) {
      setChat(prev => [...prev, { role: 'coach', text: `Sorry, I couldn't respond. ${err.message}` }]);
    } finally {
      setAsking(false);
    }
  };

  const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; color?: string }> = ({ icon, label, color = 'primary.main' }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Box sx={{ color }}>{icon}</Box>
      <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color }}>{label}</Typography>
    </Box>
  );

  const formatAge = (iso: string) => {
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  if (user !== null && !user.is_premium && !user.is_admin) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <GlassCard sx={{ p: 5, borderRadius: '24px' }}>
          <Avatar sx={{ width: 72, height: 72, mx: 'auto', mb: 2, background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)', border: '3px solid rgba(245,158,11,0.4)', fontSize: '2rem' }}>🥋</Avatar>
          <LockIcon sx={{ color: 'primary.main', fontSize: 28, mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Axiom is Pro-only</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Unlock AI-powered coaching with a Pro subscription.</Typography>
          <Button variant="contained" size="large" onClick={() => setUpgradeOpen(true)} sx={{ borderRadius: '12px', fontWeight: 800, background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#0A0B14' }}>Upgrade to Pro</Button>
        </GlassCard>
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} featureName="Axiom AI Coaching" />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, pb: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 48, height: 48, background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)', border: '2px solid rgba(245,158,11,0.45)', fontSize: '1.5rem' }}>🥋</Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>Axiom</Typography>
            {generatedAt && <Typography variant="caption" color="text.disabled">Updated {formatAge(generatedAt)}</Typography>}
          </Box>
        </Box>
        <Button size="small" variant="outlined" startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={handleRefresh} disabled={refreshing || loadingReport} sx={{ borderRadius: '10px' }}>
          {report ? 'Refresh' : 'Initialize'}
        </Button>
      </Box>

      <Stack spacing={3}>
        {loadingDaily ? <LinearProgress /> : dailyBrief && (
          <Box sx={{ p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(245,158,11,0.06) 100%)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <SectionHeader icon={<AutoAwesomeIcon />} label="Axiom Daily Protocol" color="#A78BFA" />
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800 }}>Primary Match</Typography>
                <GlassCard sx={{ p: 2, mt: 1, cursor: 'pointer' }} onClick={() => navigate(`/profile/${dailyBrief.match.id}`)}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{String(dailyBrief.match.name)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{String(dailyBrief.match.reason)}</Typography>
                </GlassCard>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" sx={{ color: '#EC4899', fontWeight: 800 }}>Featured Event</Typography>
                <GlassCard sx={{ p: 2, mt: 1, cursor: 'pointer' }} onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(String(dailyBrief.event.title))}`, '_blank')}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{String(dailyBrief.event.title)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{String(dailyBrief.event.reason)}</Typography>
                </GlassCard>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 800 }}>Visit Place</Typography>
                <GlassCard sx={{ p: 2, mt: 1, cursor: 'pointer' }} onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(String(dailyBrief.place.name))}`, '_blank')}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{String(dailyBrief.place.name)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{String(dailyBrief.place.reason)}</Typography>
                </GlassCard>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="overline" sx={{ color: '#10B981', fontWeight: 800 }}>Strategic Resources</Typography>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  {Array.isArray(dailyBrief.resources) && dailyBrief.resources.map((res, i) => (
                    <Box key={i} sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700 }}>Goal: {String(res.goal)}</Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, my: 0.5 }}>{String(res.suggestion)}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{String(res.details)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="overline" sx={{ color: '#F59E0B', fontWeight: 800 }}>Suggested Competition</Typography>
                <Box sx={{ p: 2, mt: 1, bgcolor: 'rgba(245,158,11,0.05)', borderRadius: 2, border: '1px dashed #F59E0B' }}>
                  <Typography variant="subtitle2" sx={{ color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase' }}>{String(dailyBrief.challenge?.type)}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(dailyBrief.challenge?.target)}</Typography>
                  <Typography variant="caption" display="block">{String(dailyBrief.challenge?.terms)}</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="overline" sx={{ color: '#A78BFA', fontWeight: 800 }}>Daily Routine (9-5 Friendly)</Typography>
                <Box sx={{ mt: 1, maxHeight: 300, overflowY: 'auto', pr: 1 }}>
                  {Array.isArray(dailyBrief.routine) && dailyBrief.routine.map((step, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                      <Typography variant="caption" sx={{ minWidth: 55, fontWeight: 800, color: 'primary.main' }}>{String(step.time)}</Typography>
                      <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{String(step.task)}</Typography><Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25 }}>{String(step.alignment)}</Typography></Box>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {loadingReport ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography color="text.secondary">Reviewing your full strategy...</Typography>
          </Box>
        ) : report ? (
          <>
            <Box sx={{ p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(139,92,246,0.06) 100%)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <SectionHeader icon={<Box sx={{ fontSize: '1.1rem' }}>🥋</Box>} label="Axiom's Take" />
              <Typography variant="body1" sx={{ lineHeight: 1.9, color: 'text.primary' }}>{report.motivation}</Typography>
            </Box>
            <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <SectionHeader icon={<FlagIcon />} label="Goal Strategy" color="#10B981" />
              <Stack spacing={1.5}>
                {report.strategy.map((item, i) => (
                  <Accordion key={i} disableGutters elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${DOMAIN_COLORS[item.domain] || '#9CA3AF'}33`, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />} sx={{ px: 2, py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
                        <Box sx={{ flexGrow: 1 }}><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.goal}</Typography><Chip label={item.domain} size="small" sx={{ height: 18, fontSize: '0.65rem' }} /></Box>
                        <Typography variant="caption" color="text.disabled">{item.progress}%</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 2, pb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{item.insight}</Typography>
                      <Stack spacing={1}>{item.steps.map((s, j) => <Typography key={j} variant="body2">✓ {s}</Typography>)}</Stack>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            </Box>
            <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <SectionHeader icon={<PeopleIcon />} label="Network Leverage" color="#8B5CF6" />
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>{report.network}</Typography>
            </Box>
          </>
        ) : (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Axiom is ready</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>He hasn't prepared your full strategy yet.</Typography>
            <Button variant="contained" onClick={generateBrief} startIcon={<AutoAwesomeIcon />} sx={{ borderRadius: '12px', fontWeight: 800 }}>Wake Up Axiom</Button>
          </GlassCard>
        )}

        <Box sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <SectionHeader icon={<Box sx={{ fontSize: '1rem' }}>🥋</Box>} label="Ask Axiom" />
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {chat.map((msg, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'coach' && <Avatar sx={{ width: 32, height: 32 }}>🥋</Avatar>}
                <Box sx={{ maxWidth: '80%', px: 2, py: 1.5, borderRadius: '16px', bgcolor: msg.role === 'user' ? 'primary.main' : 'rgba(255,255,255,0.06)', color: msg.role === 'user' ? '#0A0B14' : 'text.primary' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.text}</Typography>
                </Box>
              </Box>
            ))}
            <div ref={chatEndRef} />
          </Stack>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField fullWidth multiline maxRows={4} placeholder="Ask Axiom…" value={question} onChange={e => setQuestion(e.target.value)} size="small" />
            <IconButton onClick={handleAsk} disabled={!question.trim() || asking} sx={{ bgcolor: 'primary.main', color: '#0A0B14', borderRadius: '12px' }}>
              {asking ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
      </Stack>
    </Container>
  );
};

export default AICoachPage;
