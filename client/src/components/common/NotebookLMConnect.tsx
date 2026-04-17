/**
 * NotebookLM Settings Component
 * Lets users connect their NotebookLM account to Praxis
 * Users paste their Google auth cookies from browser DevTools
 */

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Alert, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import NotebookLMIcon from '@mui/icons-material/AutoAwesome';

interface NotebookStatus {
  isConnected: boolean;
  notebooksCount: number;
  notebookIds: string[];
}

interface Props {
  userId: string;
  apiBase?: string;
}

export const NotebookLMConnect: React.FC<Props> = ({ userId, apiBase = '' }) => {
  const [status, setStatus] = useState<NotebookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cookieInput, setCookieInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [notebooksLoading, setNotebooksLoading] = useState(false);
  const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${apiBase}/axiom/notebooklm/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setStatus(data);
      setSelectedNotebooks(data.notebookIds || []);
    } catch (err: any) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      // Parse cookies from input
      const cookies: Record<string, string> = {};
      const lines = cookieInput.trim().split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          cookies[key.trim()] = valueParts.join(':').trim();
        }
      }

      if (!cookies['SNlM0e'] || !cookies['FdrFJe']) {
        setError('Must include SNlM0e and FdrFJe cookies. See instructions below.');
        return;
      }

      const res = await fetch(`${apiBase}/axiom/notebooklm/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ cookies }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Connection failed');
        return;
      }

      setDialogOpen(false);
      setCookieInput('');
      fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch(`${apiBase}/axiom/notebooklm/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      fetchStatus();
    } catch {}
  };

  const handleSelectNotebooks = async () => {
    try {
      await fetch(`${apiBase}/axiom/notebooklm/notebooks`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ notebookIds: selectedNotebooks }),
      });
      fetchStatus();
    } catch {}
  };

  const openNotebookSelector = async () => {
    setNotebooksLoading(true);
    setDialogOpen(true);
    try {
      const res = await fetch(`${apiBase}/axiom/notebooklm/notebooks`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setNotebooks(data.notebooks || []);
    } catch {} finally {
      setNotebooksLoading(false);
    }
  };

  if (loading) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <NotebookLMIcon sx={{ color: '#A78BFA', fontSize: 24 }} />
        <Typography variant="subtitle1" fontWeight={700}>
          NotebookLM Integration
        </Typography>
        {status?.isConnected ? (
          <Chip label="Connected" color="success" size="small" />
        ) : (
          <Chip label="Not connected" size="small" variant="outlined" />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}

      {status?.isConnected ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Axiom will query your NotebookLM notebooks during midnight scan for richer insights.
            {status.notebooksCount > 0 && ` ${status.notebooksCount} notebook(s) selected.`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={openNotebookSelector}
              sx={{ borderRadius: '8px', fontSize: '0.75rem' }}
            >
              Select Notebooks ({status.notebooksCount})
            </Button>
            <Button
              variant="text"
              size="small"
              color="error"
              onClick={handleDisconnect}
              sx={{ fontSize: '0.75rem' }}
            >
              Disconnect
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Connect NotebookLM to give Axiom access to your research notebooks.
            Axiom will query them for holistic insights during midnight scan.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setDialogOpen(true)}
            sx={{ borderRadius: '8px', fontSize: '0.75rem' }}
          >
            Connect NotebookLM
          </Button>
        </Box>
      )}

      {/* Cookie Input Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Connect NotebookLM</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.75rem' }}>
            <strong>How to get your cookies:</strong>
            <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
              <li>Open <a href="https://notebooklm.google.com" target="_blank" rel="noopener">notebooklm.google.com</a> and sign in</li>
              <li>Press F12 → Application tab → Cookies → notebooklm.google.com</li>
              <li>Copy the <code>SNlM0e</code> and <code>FdrFJe</code> values</li>
              <li>Paste below as: <code>SNlM0e: &lt;value&gt;</code> on one line, <code>FdrFJe: &lt;value&gt;</code> on the next</li>
            </ol>
          </Alert>

          {notebooksLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notebooks.length > 0 ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Select notebooks for Axiom to query:
              </Typography>
              {notebooks.map(nb => (
                <Box key={nb.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <input
                    type="checkbox"
                    id={nb.id}
                    checked={selectedNotebooks.includes(nb.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedNotebooks(prev => [...prev, nb.id]);
                      } else {
                        setSelectedNotebooks(prev => prev.filter((id: string) => id !== nb.id));
                      }
                    }}
                  />
                  <Typography variant="body2" component="label" htmlFor={nb.id} sx={{ cursor: 'pointer' }}>
                    {nb.title}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <TextField
              label="Paste cookies"
              placeholder={"SNlM0e: YOUR_CSRF_TOKEN_VALUE\nFdrFJe: YOUR_SESSION_ID_VALUE"}
              multiline
              rows={4}
              fullWidth
              value={cookieInput}
              onChange={e => setCookieInput(e.target.value)}
              sx={{ mb: 1 }}
              helperText="One cookie per line: key:value"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          {notebooks.length > 0 ? (
            <Button variant="contained" onClick={handleSelectNotebooks} disabled={selectedNotebooks.length === 0}>
              Save Selection
            </Button>
          ) : (
            <Button variant="contained" onClick={handleConnect} disabled={connecting || !cookieInput.trim()}>
              {connecting ? <CircularProgress size={16} /> : 'Connect'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotebookLMConnect;
