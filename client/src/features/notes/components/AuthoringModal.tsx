import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, Chip, CircularProgress,
  Stack, IconButton, Alert, Avatar, Paper
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../../../lib/api';
import toast from 'react-hot-toast';

interface AuthoringEntry {
  type: string;
  date: string;
  text: string;
}

interface AuthoringSession {
  id: string;
  topic: string | null;
  dateRange: { start: string; end: string } | null;
  entries: AuthoringEntry[];
  messages: Array<{ role: 'user' | 'axiom'; content: string }>;
  narrativeDraft?: string;
  phase: 'selecting' | 'authoring' | 'reviewing' | 'completed';
  createdAt: string;
}

interface AuthoringModalProps {
  open: boolean;
  onClose: () => void;
  userPoints: number;
  isPremium: boolean;
  userName?: string;
}

export default function AuthoringModal({ open, onClose, userPoints, isPremium, userName }: AuthoringModalProps) {
  const [step, setStep] = useState<'topic' | 'date' | 'dialogue' | 'review'>('topic');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [suggestedTopics, setSuggestedTopics] = useState<Array<{ topic: string; description: string; entryCount: number }>>([]);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'axiom'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [narrativeDraft, setNarrativeDraft] = useState<string>('');
  const [cost] = useState(200);
  const [hasExistingSession, setHasExistingSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check for existing session on mount
  useEffect(() => {
    if (open) {
      checkExistingSession();
    }
  }, [open]);

  // Save session to LocalStorage whenever state changes
  useEffect(() => {
    if (sessionId && (messages.length > 0 || narrativeDraft)) {
      const sessionData = {
        id: sessionId,
        topic,
        messages,
        narrativeDraft,
        step,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`praxis_authoring_session_${sessionId}`, JSON.stringify(sessionData));
    }
  }, [sessionId, messages, narrativeDraft, step, topic]);

  // Load suggested topics on open
  useEffect(() => {
    if (open && step === 'topic' && !hasExistingSession) {
      loadSuggestedTopics();
    }
  }, [open, step, hasExistingSession]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkExistingSession = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('praxis_authoring_session_'));
    if (keys.length > 0) {
      const latestKey = keys.sort().pop();
      const data = localStorage.getItem(latestKey!);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const sessionAge = Date.now() - new Date(parsed.updatedAt).getTime();
          if (sessionAge < 24 * 60 * 60 * 1000 && parsed.step !== 'review') {
            setHasExistingSession(true);
            setSessionId(parsed.id);
            setTopic(parsed.topic || '');
            setMessages(parsed.messages || []);
            setNarrativeDraft(parsed.narrativeDraft || '');
            setStep(parsed.step || 'dialogue');
          }
        } catch {}
      }
    }
  };

  const resumeSession = () => {
    setHasExistingSession(false);
  };

  const discardSession = () => {
    if (sessionId) {
      localStorage.removeItem(`praxis_authoring_session_${sessionId}`);
    }
    setHasExistingSession(false);
    setSessionId(null);
    setTopic('');
    setMessages([]);
    setNarrativeDraft('');
    loadSuggestedTopics();
  };

  const loadSuggestedTopics = async () => {
    setLoading(true);
    try {
      const res = await api.post('/authoring/suggest-topics');
      setSuggestedTopics(res.data.topics || []);
    } catch (err) {
      console.error('Failed to load topics:', err);
      setSuggestedTopics([]);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (selectedTopic: string | null, useDateRange: boolean = false) => {
    setLoading(true);
    try {
      const res = await api.post('/authoring/start', {
        topic: selectedTopic,
        startDate: useDateRange ? startDate : null,
        endDate: useDateRange ? endDate : null,
      });

      const data = res.data;
      setSessionId(data.sessionId);
      setTopic(selectedTopic || '');

      if (!isPremium) {
        // Points deducted on backend
      }

      const initialMsg = data.initialMessage;
      setMessages([{ role: 'axiom', content: initialMsg }]);
      setStep('dialogue');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;
    const userInput = input.trim();
    setInput('');
    setLoading(true);

    try {
      const res = await api.post(`/authoring/session/${sessionId}/continue`, {
        userInput,
        sessionData: { messages, phase: 'authoring', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });

      setMessages(prev => [...prev, { role: 'user', content: userInput }, { role: 'axiom', content: res.data.response }]);

      if (res.data.isComplete) {
        setNarrativeDraft(res.data.response);
        setStep('review');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to continue');
    } finally {
      setLoading(false);
    }
  };

  const regenerateNarrative = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await api.post(`/authoring/session/${sessionId}/continue`, {
        regenerate: true,
        sessionData: { messages, phase: 'authoring', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });

      setNarrativeDraft(res.data.response);
      setMessages(prev => [...prev, { role: 'axiom', content: res.data.response }]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to regenerate');
    } finally {
      setLoading(false);
    }
  };

  const downloadNarrative = () => {
    const blob = new Blob([narrativeDraft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `praxis-narrative-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Narrative downloaded!');
    onClose();
  };

  const handleClose = () => {
    setStep('topic');
    setSessionId(null);
    setTopic('');
    setMessages([]);
    setNarrativeDraft('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '24px', bgcolor: '#0F0F12', color: '#fff' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(245,158,11,0.2)' }}>
            <AutoAwesomeIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Interactive Authoring
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {step === 'topic' && 'Choose a theme or date range'}
              {step === 'date' && 'Select your time period'}
              {step === 'dialogue' && 'Write with Axiom as your editor'}
              {step === 'review' && 'Review your narrative'}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {!isPremium && step !== 'topic' && (
            <Chip label={`${cost} PP`} size="small" sx={{ height: 20, bgcolor: 'rgba(245,158,11,0.2)', color: '#F59E0B' }} />
          )}
          {isPremium && (
            <Chip label="PRO" size="small" sx={{ height: 20, bgcolor: 'rgba(245,158,11,0.2)', color: '#F59E0B' }} />
          )}
          <IconButton onClick={handleClose} size="small" sx={{ color: '#9CA3AF' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ minHeight: 400, display: 'flex', flexDirection: 'column' }}>
        {step === 'topic' && (
          <Stack spacing={3} sx={{ mt: 1 }}>
            {hasExistingSession && (
              <Alert
                severity="warning"
                sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#FCD34D', border: 'none' }}
                action={
                  <Stack direction="row" spacing={1}>
                    <Button color="inherit" size="small" onClick={resumeSession}>
                      Resume
                    </Button>
                    <Button color="inherit" size="small" onClick={discardSession}>
                      Discard
                    </Button>
                  </Stack>
                }
              >
                You have an unfinished authoring session. Would you like to continue?
              </Alert>
            )}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} sx={{ color: '#F59E0B' }} />
              </Box>
            ) : (
              <>
                <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#93C5FD', border: 'none' }}>
                  Select a theme (Axiom will find relevant entries) or pick a date range manually.
                </Alert>

                {suggestedTopics.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#9CA3AF' }}>
                      Suggested Themes
                    </Typography>
                    <Stack spacing={1}>
                      {suggestedTopics.map((t, i) => (
                        <Paper
                          key={i}
                          onClick={() => startSession(t.topic)}
                          sx={{
                            p: 2, cursor: 'pointer', borderRadius: '12px',
                            bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                            '&:hover': { bgcolor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {t.topic}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t.description}
                          </Typography>
                          <Chip label={`${t.entryCount} entries`} size="small" sx={{ ml: 1, height: 16, fontSize: '0.6rem' }} />
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    — or pick a custom date range —
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => setStep('date')}
                    sx={{ borderRadius: '20px', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                  >
                    Select Dates
                  </Button>
                </Box>
              </>
            )}
          </Stack>
        )}

        {step === 'date' && (
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                Start Date
              </Typography>
              <TextField
                type="date"
                fullWidth
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                InputProps={{ sx: { borderRadius: '12px', color: '#fff' } }}
                InputLabelProps={{ sx: { color: '#9CA3AF' } }}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                End Date
              </Typography>
              <TextField
                type="date"
                fullWidth
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                InputProps={{ sx: { borderRadius: '12px', color: '#fff' } }}
              />
            </Box>
            <Stack direction="row" spacing={2}>
              <Button onClick={() => setStep('topic')} sx={{ borderRadius: '20px', color: '#9CA3AF' }}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => startSession(null, true)}
                disabled={!startDate || !endDate || loading}
                sx={{ borderRadius: '20px', bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
              >
                Start Writing
              </Button>
            </Stack>
          </Stack>
        )}

        {step === 'dialogue' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ flex: 1, overflowY: 'auto', mb: 2, pr: 1 }}>
              {messages.map((m, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '85%',
                      p: 1.5, borderRadius: '16px',
                      bgcolor: m.role === 'user' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                      borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                      borderBottomLeftRadius: m.role === 'user' ? '16px' : '4px',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {m.content}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.05)' }}>
                    <CircularProgress size={16} sx={{ color: '#F59E0B' }} />
                  </Box>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Type your response..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                disabled={loading}
                multiline
                maxRows={3}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '20px',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  },
                }}
              />
              <IconButton
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                sx={{
                  bgcolor: '#F59E0B',
                  color: '#000',
                  borderRadius: '20px',
                  '&:hover': { bgcolor: '#D97706' },
                  '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        )}

        {step === 'review' && (
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="success" sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: '#4ADE80', border: 'none' }}>
              Your narrative is ready! You can download it now or regenerate with different focus.
            </Alert>

            <Paper sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)', maxHeight: 300, overflowY: 'auto' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {narrativeDraft}
              </Typography>
            </Paper>

            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={regenerateNarrative}
                disabled={loading}
                sx={{ borderRadius: '20px', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
              >
                Regenerate
              </Button>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={downloadNarrative}
                sx={{ borderRadius: '20px', bgcolor: '#F59E0B', color: '#000', '&:hover': { bgcolor: '#D97706' } }}
              >
                Download .txt
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}