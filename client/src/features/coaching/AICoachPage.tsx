import React, { useState, useEffect, useRef, useCallback } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagIcon from '@mui/icons-material/Flag';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockIcon from '@mui/icons-material/Lock';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DownloadIcon from '@mui/icons-material/Download';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HistoryIcon from '@mui/icons-material/History';

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
  message?: string;
  match: { id: string; name: string; reason: string };
  event: { id: string; title: string; reason: string };
  place: { id: string; name: string; reason: string };
  challenge: { type: 'bet' | 'duel'; target: string; terms: string };
  resources: Array<{ goal: string; suggestion: string; details: string }>;
  routine: Array<{ time: string; task: string; alignment: string }>;
  source?: 'llm' | 'algorithm';
  llm_error?: string;
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
  
  // Last Axiom message from daily brief
  const [lastAxiomMessage, setLastAxiomMessage] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  
  // Saved narratives
  const [savedNarratives, setSavedNarratives] = useState<any[]>([]);
  const [loadingNarratives, setLoadingNarratives] = useState(false);
  const [narrativesOpen, setNarrativesOpen] = useState(false);

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
    if (!user?.id) return;
    setLoadingDaily(true);
    try {
      const headers = await getAuthHeaders();
      // Fetch latest axiom daily brief
      const { data: briefData } = await supabase
        .from('axiom_daily_briefs')
        .select('brief, generated_at')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (briefData?.brief) {
        setDailyBrief(briefData.brief);
        if (briefData.brief.message) {
          setLastAxiomMessage(briefData.brief.message);
        }
      }
      
      // Also try API endpoint
      const res = await fetch(`${API_URL}/ai-coaching/daily-brief`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.brief) {
          setDailyBrief(data.brief);
          if (data.brief.message && !lastAxiomMessage) {
            setLastAxiomMessage(data.brief.message);
          }
        }
      }
    } catch { /* ignore */ } finally {
      setLoadingDaily(false);
    }
  }, [user?.id, lastAxiomMessage]);

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
    setReportError(null);
    setDetailedError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/ai-coaching/generate-axiom-brief?force=1`, {
        method: 'POST', headers,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.brief) {
        setDailyBrief(data.brief);
        setLastAxiomMessage(data.brief.message || null);
        setGeneratedAt(data.generated_at || new Date().toISOString());
        if (data.brief.source === 'algorithm' && data.brief.llm_error) {
          setReportError(`LLM failed: ${data.brief.llm_error}. Showing algorithm-generated brief.`);
        }
      } else {
        setReportError('Failed to generate Axiom brief.');
      }
    } catch (err: any) {
      setReportError(err.message || 'Failed to refresh.');
    } finally {
      setRefreshing(false);
    }
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
    
    // Load saved narratives
    loadSavedNarratives();
    
    // Send 3 automatic algorithmic messages from Axiom on chat open
    setTimeout(() => {
      setChat([
        { 
          role: 'coach', 
          text: "👋 I'm Axiom, your accountability coach. I'm here to help you stay consistent and achieve your goals." 
        },
        { 
          role: 'coach', 
          text: "📊 I've been analyzing your progress patterns. Your consistency is key to long-term success." 
        },
        { 
          role: 'coach', 
          text: "💬 Ask me anything about your goals, routine, or accountability strategy. I'm here to help!" 
        },
      ]);
    }, 500);
    
    return () => { cancelled = true; };
  }, [loadCachedBrief, loadDailyBrief]);
  
  const loadSavedNarratives = async () => {
    setLoadingNarratives(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/narratives?limit=20`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSavedNarratives(data);
      }
    } catch (err) {
      console.error('Failed to load narratives:', err);
    } finally {
      setLoadingNarratives(false);
    }
  };
  
  const handleDownloadNarrative = async (id: string, title: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/narratives/${id}/download`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'axiom-narrative'}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Narrative downloaded!');
      }
    } catch (err: any) {
      toast.error('Failed to download: ' + err.message);
    }
  };

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
        body: JSON.stringify({ userPrompt: q, useBoost: true }), // Always use AI
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setChat(prev => [...prev, { role: 'coach', text: `⚡ ${body.message}` }]);
        return;
      }
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

  const isFree = user !== null && !user.is_premium && !user.is_admin;
  const userPoints: number = (user as any)?.praxis_points ?? 0;

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
        <Stack direction="row" spacing={1}>
          <Button 
            size="small" 
            variant="outlined" 
            startIcon={<HistoryIcon />} 
            onClick={() => setNarrativesOpen(true)}
            disabled={loadingNarratives}
            sx={{ borderRadius: '10px' }}
          >
            {loadingNarratives ? 'Loading...' : `History (${savedNarratives.length})`}
          </Button>
          <Button size="small" variant="outlined" startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={handleRefresh} disabled={refreshing} sx={{ borderRadius: '10px' }}>
            {refreshing ? 'Generating...' : 'Refresh Brief'}
          </Button>
        </Stack>
      </Box>
      
      {/* Last Axiom Message Display */}
      {lastAxiomMessage && (
        <Box sx={{
          mb: 4,
          p: 2.5,
          borderRadius: 3,
          bgcolor: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.2)',
          position: 'relative',
        }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Avatar sx={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #78350F, #92400E)',
              border: '1px solid rgba(245,158,11,0.4)',
              fontSize: '1.2rem',
              flexShrink: 0,
            }}>🥋</Avatar>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, letterSpacing: '0.08em' }}>
                  LAST FROM AXIOM
                </Typography>
                {dailyBrief?.source && (
                  <Chip
                    label={dailyBrief.source === 'llm' ? '🧠 AI' : '⚙️ Auto'}
                    size="small"
                    sx={{
                      height: 16, fontSize: '0.5rem', fontWeight: 700,
                      bgcolor: dailyBrief.source === 'llm' ? 'rgba(167,139,250,0.15)' : 'rgba(245,158,11,0.12)',
                      color: dailyBrief.source === 'llm' ? '#A78BFA' : '#F59E0B',
                      '& .MuiChip-label': { px: '5px' },
                    }}
                  />
                )}
              </Box>
              <Typography variant="body1" sx={{
                color: 'text.primary',
                lineHeight: 1.6,
                fontStyle: 'italic',
                fontSize: '0.95rem',
              }}>
                "{lastAxiomMessage}"
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Stack spacing={3}>
        {loadingDaily ? <LinearProgress /> : dailyBrief && (
          <Box sx={{ p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(245,158,11,0.06) 100%)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <SectionHeader icon={<AutoAwesomeIcon />} label="Axiom Daily Protocol" color="#A78BFA" />
            <Grid container spacing={3}>
              {dailyBrief.match && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800 }}>Primary Match</Typography>
                <GlassCard sx={{ p: 2, mt: 1, cursor: 'pointer' }} onClick={() => navigate(`/profile/${dailyBrief.match.id}`)}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{String(dailyBrief.match.name)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{String(dailyBrief.match.reason)}</Typography>
                </GlassCard>
              </Grid>
              )}
              {dailyBrief.event && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" sx={{ color: '#EC4899', fontWeight: 800 }}>Featured Event</Typography>
                <GlassCard sx={{ p: 2, mt: 1, cursor: 'pointer' }} onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(String(dailyBrief.event.title))}`, '_blank')}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{String(dailyBrief.event.title)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{String(dailyBrief.event.reason)}</Typography>
                </GlassCard>
              </Grid>
              )}
              {dailyBrief.place && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 800 }}>Visit Place</Typography>
                <GlassCard sx={{ p: 2, mt: 1, cursor: 'pointer' }} onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(String(dailyBrief.place.name))}`, '_blank')}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{String(dailyBrief.place.name)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{String(dailyBrief.place.reason)}</Typography>
                </GlassCard>
              </Grid>
              )}
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <SectionHeader icon={<Box sx={{ fontSize: '1rem' }}>🥋</Box>} label="Ask Axiom" />
            {isFree && (
              <Chip
                icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
                label={`50 PP / message · balance: ${userPoints} PP`}
                size="small"
                sx={{ fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
              />
            )}
          </Box>
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
            <IconButton onClick={() => handleAsk(false)} disabled={!question.trim() || asking} sx={{ bgcolor: 'primary.main', color: '#0A0B14', borderRadius: '12px' }}>
              {asking ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Box>
          {!isFree && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PsychologyIcon />}
              disabled={!question.trim() || asking}
              onClick={() => handleAsk(true)}
              sx={{
                mt: 1,
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.75rem',
                borderColor: 'rgba(167,139,250,0.5)',
                color: '#A78BFA',
                background: 'rgba(139,92,246,0.06)',
                '&:hover': { background: 'rgba(139,92,246,0.14)', borderColor: '#A78BFA' },
              }}
            >
              🔮 Axiom Boost — full LLM response
            </Button>
          )}
        </Box>
      </Stack>
      
      {/* Narratives History Dialog */}
      <Dialog 
        open={narrativesOpen} 
        onClose={() => setNarrativesOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MenuBookIcon sx={{ color: '#A78BFA' }} />
            Axiom Narratives History
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            All your saved daily briefs and AI narratives - auto-saved and ready to download
          </Typography>
        </DialogTitle>
        <DialogContent>
          {loadingNarratives ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress />
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>Loading narratives...</Typography>
            </Box>
          ) : savedNarratives.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
              <MenuBookIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
              <Typography variant="body2">No narratives yet</Typography>
              <Typography variant="caption">Your daily briefs and AI responses will be auto-saved here</Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 500, overflow: 'auto' }}>
              {savedNarratives.map((narrative, i) => (
                <ListItem
                  key={narrative.id}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      onClick={() => handleDownloadNarrative(narrative.id, narrative.title)}
                      size="small"
                    >
                      <DownloadIcon />
                    </IconButton>
                  }
                  sx={{
                    borderBottom: i < savedNarratives.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: narrative.narrative_type === 'daily_brief' ? 'rgba(167,139,250,0.2)' : 'rgba(245,158,11,0.2)' }}>
                      {narrative.narrative_type === 'daily_brief' ? '📅' : '💬'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {narrative.title || 'Untitled Narrative'}
                        </Typography>
                        {narrative.source === 'llm' && (
                          <Chip label="AI" size="small" sx={{ height: 16, fontSize: '0.5rem', bgcolor: 'rgba(167,139,250,0.2)', color: '#A78BFA' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          {new Date(narrative.created_at).toLocaleString()}
                        </Typography>
                        {narrative.pp_cost > 0 && (
                          <Typography variant="caption" sx={{ color: '#F59E0B' }}>
                            Cost: {narrative.pp_cost} PP
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNarrativesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AICoachPage;
