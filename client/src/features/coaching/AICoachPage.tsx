import React, { useState, useEffect, useRef, useCallback } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api';
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
  Card,
  CardContent,
  CardActionArea,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DownloadIcon from '@mui/icons-material/Download';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HistoryIcon from '@mui/icons-material/History';
import { Tooltip } from '@mui/material';
import BetCommitDialog from '../../components/common/BetCommitDialog';
import ErrorBoundary from '../../components/common/ErrorBoundary';

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

interface MatchRecommendation {
  id: string;
  name: string;
  reason: string;
  avatarUrl?: string;
}

// ── component ─────────────────────────────────────────────────────────────────

const AICoachPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [chatLoaded, setChatLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  
  // Saved narratives
  const [savedNarratives, setSavedNarratives] = useState<any[]>([]);
  const [loadingNarratives, setLoadingNarratives] = useState(false);
  const [narrativesOpen, setNarrativesOpen] = useState(false);

  // Bet dialog state
  const [isBetDialogOpen, setIsBetDialogOpen] = useState(false);

  // Match recommendation dialog state
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchRecommendation | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadCachedBrief = useCallback(async () => {
    const res = await api.get('/ai-coaching/brief');
    return res.data as { brief: CoachingReport; generated_at: string } | null;
  }, []);

  const loadDailyBrief = useCallback(async () => {
    if (!user?.id) return;
    setLoadingDaily(true);
    try {
      // Fetch latest axiom daily brief
      const { data: briefData, error: supabaseError } = await supabase
        .from('axiom_daily_briefs')
        .select('brief, generated_at')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (supabaseError) {
        console.error('Failed to fetch axiom brief from Supabase:', supabaseError);
      }

      if (briefData?.brief) {
        setDailyBrief(briefData.brief);
        if (briefData.brief.message) {
          setLastAxiomMessage(briefData.brief.message);
        }
      }

      // Also try API endpoint
      try {
        const apiRes = await api.get('/ai-coaching/daily-brief');
        if (apiRes.data?.brief) {
          setDailyBrief(apiRes.data.brief);
          if (apiRes.data.brief.message && !lastAxiomMessage) {
            setLastAxiomMessage(apiRes.data.brief.message);
          }
        }
      } catch (apiErr: any) {
        console.warn('API daily brief endpoint returned non-OK status:', apiErr.response?.status);
      }
    } catch (err: any) {
      console.error('Failed to load daily brief:', err);
      toast.error('Failed to load daily brief');
    } finally {
      setLoadingDaily(false);
    }
  }, [user?.id, lastAxiomMessage]);

  const generateBrief = useCallback(async () => {
    setLoadingReport(true);
    setReportError(null);
    setDetailedError(null);
    try {
      const res = await api.post('/ai-coaching/report');
      setReport(res.data);
      setGeneratedAt(new Date().toISOString());
    } catch (err: any) {
      const body = err.response?.data || {};
      setDetailedError(body.detailed || null);
      setReportError(body.message || err.message || 'Failed to generate coaching report.');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  const handleCreateChallenge = () => {
    setIsBetDialogOpen(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setReportError(null);
    setDetailedError(null);
    try {
      const res = await api.post('/ai-coaching/generate-axiom-brief?force=1');
      const data = res.data;
      if (data?.brief) {
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
      } catch (err: any) {
        console.error('Cache load error:', err);
        toast.error('Failed to load cached coaching report');
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    })();

    // Load saved narratives
    loadSavedNarratives();

    // Load persisted Axiom chat history
    loadChatHistory();

    return () => { cancelled = true; };
  }, [loadCachedBrief, loadDailyBrief]);
  
  const loadChatHistory = async () => {
    if (!user?.id) return;
    try {
      // Fetch Axiom chat messages (user questions + AI responses)
      const { data: msgs } = await supabase
        .from('messages')
        .select('content, is_ai, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('is_ai', true)
        .order('created_at', { ascending: true })
        .limit(50);

      // Also fetch user's questions to Axiom (sender_id = user, receiver_id = user which is how AI msgs are stored)
      const { data: userMsgs } = await supabase
        .from('messages')
        .select('content, is_ai, created_at, sender_id, receiver_id')
        .eq('sender_id', user.id)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);

      // Merge and sort — AI responses have is_ai=true, user questions don't
      const allMsgs = [
        ...(Array.isArray(msgs) ? msgs : []).map(m => ({ ...m, role: 'coach' as const })),
        ...(Array.isArray(userMsgs) ? userMsgs : []).filter(m => !m.is_ai).map(m => ({ ...m, role: 'user' as const })),
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      if (allMsgs.length > 0) {
        setChat(allMsgs.map(m => ({ role: m.role, text: m.content })));
      } else {
        // No history — show welcome
        setChat([
          { role: 'coach', text: "I'm Axiom, your accountability coach. Ask me anything about your goals, routine, people, places, events, or notes." },
        ]);
      }
    } catch {
      setChat([
        { role: 'coach', text: "I'm Axiom. Ask me anything about your goals, routine, or strategy." },
      ]);
    } finally {
      setChatLoaded(true);
    }
  };

  // When navigated from Notebook with an axiom_brief, inject it into chat
  useEffect(() => {
    const state = location.state as { axiomBrief?: { title: string; content: string; date: string } } | null;
    if (chatLoaded && state?.axiomBrief) {
      const brief = state.axiomBrief;
      const briefDate = new Date(brief.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      setChat(prev => [
        ...prev,
        { role: 'coach', text: `📋 **${brief.title}**\n\n${brief.content}\n\n_From ${briefDate}. Ask me anything about this brief._` },
      ]);
      // Clear location state so refresh doesn't re-inject
      window.history.replaceState({}, '');
    }
  }, [chatLoaded, location.state]);

  const loadSavedNarratives = async () => {
    setLoadingNarratives(true);
    try {
      const res = await api.get('/narratives?limit=20');
      setSavedNarratives(res.data);
    } catch (err) {
      console.error('Failed to load narratives:', err);
    } finally {
      setLoadingNarratives(false);
    }
  };
  
  const handleDownloadNarrative = async (id: string, title: string) => {
    try {
      const res = await api.get(`/narratives/${id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'axiom-narrative'}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Narrative downloaded!');
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
      const res = await api.post('/ai-coaching/request', { userPrompt: q, useBoost: true });
      setChat(prev => [...prev, { role: 'coach', text: res.data.response }]);
    } catch (err: any) {
      const body = err.response?.data || {};
      const msg = body.detailed ? `${body.message} (${body.detailed})` : (body.message || err.message);
      setChat(prev => [...prev, { role: 'coach', text: `Sorry, I couldn't respond. ${msg}` }]);
    } finally {
      setAsking(false);
    }
  };

  const handleSearchNotebooks = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setQuestion('');
    setAsking(true);
    setChat(prev => [...prev, { role: 'user', text: `🔍 Search notebooks: ${q}` }]);
    try {
      const res = await api.post('/axiom/agent', { query: q, allow_web_search: false });
      const { message, sources, matches, notebookResultsCount } = res.data;
      
      let responseText = message;
      if (sources?.length) {
        responseText += `\n\n📚 *Found ${notebookResultsCount} notebook entries - cited ${sources.length}*`;
      }
      if (matches?.length) {
        responseText += `\n\n🤝 *Recommended:* ${matches.map((m: any) => `**${m.name}**`).join(', ')} — tap to view`;
        // Store first match for dialog
        setSelectedMatch(matches[0]);
      }
      
      setChat(prev => [...prev, { role: 'coach', text: responseText }]);
    } catch (err: any) {
      const body = err.response?.data || {};
      const msg = body.detailed ? `${body.message} (${body.detailed})` : (body.message || err.message);
      setChat(prev => [...prev, { role: 'coach', text: `Search failed. ${msg}` }]);
    } finally {
      setAsking(false);
    }
  };

  const handleMatchClick = (match: MatchRecommendation) => {
    setSelectedMatch(match);
    setMatchDialogOpen(true);
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
        <ErrorBoundary label="Daily Protocol">
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
                <Box 
                  sx={{ 
                    p: 2, 
                    mt: 1, 
                    bgcolor: 'rgba(245,158,11,0.05)', 
                    borderRadius: 2, 
                    border: '1px dashed #F59E0B',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(245,158,11,0.08)',
                      borderColor: '#F59E0B',
                    }
                  }} 
                  onClick={handleCreateChallenge}
                >
                  <Typography variant="subtitle2" sx={{ color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase' }}>
                    {String(dailyBrief.challenge?.type)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {String(dailyBrief.challenge?.target)}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mb: 1, color: 'text.secondary' }}>
                    {String(dailyBrief.challenge?.terms)}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{
                      mt: 1,
                      bgcolor: '#F59E0B',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      px: 2,
                      '&:hover': { bgcolor: '#D97706' },
                    }}
                  >
                    Accept Challenge
                  </Button>
                </Box>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="overline" sx={{ color: '#A78BFA', fontWeight: 800 }}>Daily Routine</Typography>
                <Box sx={{
                  display: 'flex', gap: 1.5, mt: 1, overflowX: 'auto', pb: 2,
                  '&::-webkit-scrollbar': { height: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(139,92,246,0.3)', borderRadius: 2 },
                }}>
                  {Array.isArray(dailyBrief.routine) && dailyBrief.routine.map((step, i) => (
                    <Box key={i} sx={{
                      minWidth: 180, maxWidth: 200, flexShrink: 0,
                      p: 1.5, borderRadius: '12px',
                      bgcolor: 'rgba(167,139,250,0.06)',
                      border: '1px solid rgba(167,139,250,0.15)',
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', display: 'block', mb: 0.5 }}>{String(step.time)}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(step.task)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>{String(step.alignment)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
        </ErrorBoundary>

        <ErrorBoundary label="Strategy Report">
        {loadingReport ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography color="text.secondary">Reviewing your full strategy...</Typography>
          </Box>
        ) : report ? (
          <>
            <GlassCard sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">Strategy report ready. Check your daily brief for details.</Typography>
            </GlassCard>
          </>
        ) : (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Axiom is ready</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>He hasn't prepared your full strategy yet.</Typography>
            <Button variant="contained" onClick={generateBrief} startIcon={<AutoAwesomeIcon />} sx={{ borderRadius: '12px', fontWeight: 800 }}>Wake Up Axiom</Button>
          </GlassCard>
        )}
        </ErrorBoundary>

        <ErrorBoundary label="Ask Axiom">
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
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              fullWidth multiline maxRows={4}
              placeholder="Ask Axiom about goals, people, places, events, notes…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              size="small"
              sx={{ flex: 1 }}
            />
            <Tooltip title="Search notebooks">
              <IconButton 
                onClick={handleSearchNotebooks} 
                disabled={!question.trim() || asking}
                sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#A78BFA', borderRadius: '12px', '&:hover': { bgcolor: 'rgba(139,92,246,0.3)' } }}
              >
                <SearchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton onClick={handleAsk} disabled={!question.trim() || asking} sx={{ bgcolor: 'primary.main', color: '#0A0B14', borderRadius: '12px' }}>
              {asking ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
        </ErrorBoundary>
      </Stack>

      {dailyBrief?.challenge && (
        <BetCommitDialog
          open={isBetDialogOpen}
          onClose={() => setIsBetDialogOpen(false)}
          challenge={dailyBrief.challenge}
          onSuccess={() => navigate('/commitments')}
        />
      )}

      {/* Match Recommendation Dialog */}
      <Dialog
        open={matchDialogOpen}
        onClose={() => setMatchDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
            🤝 Sparring Partner
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedMatch && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Avatar
                src={selectedMatch.avatarUrl}
                sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}
              >
                {selectedMatch.name?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                {selectedMatch.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {selectedMatch.reason}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  onClick={() => setMatchDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    setMatchDialogOpen(false);
                    navigate(`/discover?user=${selectedMatch.id}`);
                  }}
                >
                  View Profile
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
      
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
