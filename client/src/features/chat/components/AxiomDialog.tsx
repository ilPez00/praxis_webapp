import React, { useState } from 'react';
import api from '../../../lib/api';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface AxiomDialogProps {
  open: boolean;
  onClose: () => void;
}

const AxiomDialog: React.FC<AxiomDialogProps> = ({ open, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResponse('');
    try {
      const res = await api.post('/ai-coaching/request', {
        userPrompt: prompt.trim(),
      });
      setResponse(res.data.response || '...');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Axiom is unavailable right now.';
      setResponse(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPrompt('');
      setResponse('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon sx={{ color: '#A78BFA', fontSize: 20 }} />
        Ask Axiom
        <IconButton size="small" onClick={handleClose} sx={{ ml: 'auto', color: 'text.disabled' }} disabled={loading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            fullWidth
            size="small"
            multiline
            rows={3}
            placeholder="Ask Axiom anything — strategy, accountability, mindset, next steps…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
            disabled={loading}
          />
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CircularProgress size={16} sx={{ color: '#A78BFA' }} />
              <Typography variant="caption" color="text.secondary">Axiom is thinking…</Typography>
            </Box>
          )}
          {response && !loading && (
            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.2)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>Axiom</Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {response}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>Close</Button>
        <Button
          variant="contained"
          onClick={handleAsk}
          disabled={loading || !prompt.trim()}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
          sx={{ bgcolor: '#A78BFA', '&:hover': { bgcolor: '#8B5CF6' }, color: '#fff', borderRadius: 2 }}
        >
          {loading ? 'Asking…' : 'Ask'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AxiomDialog;
