import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Stack,
  Avatar,
  Paper,
  CircularProgress,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';

interface AxiomQueryDialogProps {
  open: boolean;
  onClose: () => void;
}

interface QueryResult {
  question: string;
  answer: string;
  cost: number;
  newBalance: number;
}

const AxiomQueryDialog: React.FC<AxiomQueryDialogProps> = ({ open, onClose }) => {
  const { user } = useUser();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [isPremium, setIsPremium] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const QUERY_COST = 50;

  // Fetch user points on open
  useEffect(() => {
    if (open && user?.id) {
      fetchUserProfile();
      setResult(null);
      setError(null);
      setQuestion('');
    }
  }, [open, user?.id]);

  // Scroll to bottom when result arrives
  useEffect(() => {
    if (result && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result]);

  const fetchUserProfile = async () => {
    try {
      const { data: profile } = await api.get('/auth/profile');
      if (profile) {
        setUserPoints(profile.praxis_points || 0);
        setIsPremium(profile.is_premium || false);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const handleAsk = async () => {
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.post('/notebook/axiom-query', {
        question: question.trim(),
      });

      setResult(res.data);
      setUserPoints(res.data.newBalance);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Failed to query Axiom. Please try again.';
      setError(errorMsg);
      
      // If insufficient points, show upgrade hint
      if (err?.response?.data?.error === 'INSUFFICIENT_POINTS') {
        setError(
          `Insufficient Praxis Points. You need ${QUERY_COST} PP for this query.\n\n` +
          `Tip: Premium members get unlimited Axiom queries!`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    setQuestion('');
    onClose();
  };

  // Suggested questions
  const suggestedQuestions = [
    "What patterns do you see in my recent entries?",
    "How consistent have I been with my goals?",
    "What's my most common mood this week?",
    "Which tags do I use most frequently?",
    "Am I making progress on my main goals?",
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          bgcolor: 'rgba(30, 30, 40, 0.98)',
          border: '1px solid rgba(167, 139, 250, 0.3)',
        },
      }}
    >
      <DialogTitle
        sx={{
          bgcolor: 'rgba(167, 139, 250, 0.08)',
          borderBottom: '1px solid rgba(167, 139, 250, 0.2)',
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              bgcolor: 'rgba(167, 139, 250, 0.2)',
              border: '1px solid rgba(167, 139, 250, 0.4)',
              width: 40,
              height: 40,
            }}
          >
            <AutoAwesomeIcon sx={{ color: '#A78BFA' }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#A78BFA' }}>
              Ask Axiom
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isPremium ? (
                <Chip label="Premium - Unlimited Queries" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              ) : (
                `${QUERY_COST} PP per query`
              )}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, minHeight: 400 }}>
        {/* User Points Display */}
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            bgcolor: 'rgba(139, 92, 246, 0.08)',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>
            YOUR BALANCE
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 800, color: '#A78BFA' }}>
            {userPoints.toLocaleString()} PP
          </Typography>
        </Box>

        {/* Result Display */}
        {result && (
          <Paper
            sx={{
              p: 2.5,
              mb: 2,
              bgcolor: 'rgba(167, 139, 250, 0.05)',
              border: '1px solid rgba(167, 139, 250, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Avatar
                  sx={{
                    bgcolor: 'rgba(167, 139, 250, 0.2)',
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 18, color: '#A78BFA' }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      lineHeight: 1.7,
                      fontSize: '0.9rem',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {result.answer}
                  </Typography>
                </Box>
              </Box>

              {!isPremium && (
                <Divider sx={{ my: 0.5 }} />
              )}

              {!isPremium && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Query cost
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: '#EF4444' }}
                  >
                    -{result.cost} PP
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </Typography>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: 6,
            }}
          >
            <Stack spacing={2} alignItems="center">
              <CircularProgress sx={{ color: '#A78BFA' }} />
              <Typography variant="body2" color="text.secondary">
                Axiom is analyzing your notebook...
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Suggested Questions (only if no result yet) */}
        {!result && !loading && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              Try asking:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {suggestedQuestions.map((q, idx) => (
                <Chip
                  key={idx}
                  label={q}
                  size="small"
                  onClick={() => setQuestion(q)}
                  sx={{
                    bgcolor: 'rgba(167, 139, 250, 0.1)',
                    color: '#A78BFA',
                    border: '1px solid rgba(167, 139, 250, 0.2)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(167, 139, 250, 0.2)',
                      border: '1px solid rgba(167, 139, 250, 0.4)',
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </DialogContent>

      <DialogActions
        sx={{
          p: 2,
          borderTop: '1px solid rgba(167, 139, 250, 0.2)',
          bgcolor: 'rgba(167, 139, 250, 0.03)',
        }}
      >
        <TextField
          fullWidth
          placeholder="Ask about your logged data, patterns, progress..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          multiline
          maxRows={3}
          InputProps={{
            sx: {
              borderRadius: '12px',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              fontSize: '0.9rem',
            },
          }}
        />
        <Button
          variant="contained"
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          sx={{
            ml: 1,
            borderRadius: '12px',
            fontWeight: 700,
            px: 2.5,
            bgcolor: '#A78BFA',
            '&:hover': { bgcolor: '#8B5CF6' },
          }}
        >
          {loading ? 'Asking...' : 'Ask'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AxiomQueryDialog;
