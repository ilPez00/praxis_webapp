import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Chip, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress, Snackbar,
} from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import { apiFetch } from './adminTypes';

interface ProcessStatus {
  running: boolean;
  backend?: {
    pid?: number;
    port?: number;
    uptime?: string;
  };
  frontend?: {
    pid?: number;
    port?: number;
    uptime?: string;
  };
}

interface CommandLog {
  timestamp: string;
  command: string;
  status: 'running' | 'success' | 'error';
  output?: string;
}

const CLITab: React.FC = () => {
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as const });

  // Fetch current process status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/cli/status');
      if (res.ok) {
        const data = await res.json();
        setProcessStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch CLI status:', error);
    }
  }, []);

  // Load initial status
  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Execute CLI command
  const executeCommand = async (command: string) => {
    setLoading(true);
    const logEntry: CommandLog = {
      timestamp: new Date().toISOString(),
      command,
      status: 'running',
    };
    setLogs(prev => [logEntry, ...prev]);

    try {
      const res = await apiFetch('/admin/cli/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      const data = await res.json();

      if (res.ok) {
        setLogs(prev => prev.map(log => 
          log.timestamp === logEntry.timestamp 
            ? { ...log, status: 'success', output: data.output }
            : log
        ));
        setSnackbar({ open: true, message: data.message || 'Command executed successfully', severity: 'success' });
        fetchStatus(); // Refresh status
      } else {
        setLogs(prev => prev.map(log => 
          log.timestamp === logEntry.timestamp 
            ? { ...log, status: 'error', output: data.error }
            : log
        ));
        setSnackbar({ open: true, message: data.error || 'Command failed', severity: 'error' });
      }
    } catch (error: any) {
      setLogs(prev => prev.map(log => 
        log.timestamp === logEntry.timestamp 
          ? { ...log, status: 'error', output: error.message }
          : log
      ));
      setSnackbar({ open: true, message: 'Failed to execute command', severity: 'error' });
    } finally {
      setLoading(false);
      setDialogOpen(false);
    }
  };

  // Handle action button click
  const handleAction = (action: string) => {
    setSelectedAction(action);
    setDialogOpen(true);
  };

  // Get status chip color
  const getStatusChip = (isRunning: boolean | undefined) => {
    if (isRunning === undefined) return <Chip label="Unknown" color="default" size="small" />;
    return isRunning ? (
      <Chip label="Running" color="success" size="small" icon={<PlayArrowIcon />} />
    ) : (
      <Chip label="Stopped" color="default" size="small" icon={<StopIcon />} />
    );
  };

  const actions = [
    {
      id: 'dev',
      title: 'Start Development',
      description: 'Start both backend and frontend in development mode',
      icon: <PlayArrowIcon />,
      color: '#10B981',
    },
    {
      id: 'stop',
      title: 'Stop All',
      description: 'Stop all running processes',
      icon: <StopIcon />,
      color: '#EF4444',
    },
    {
      id: 'restart',
      title: 'Restart',
      description: 'Stop and start all processes',
      icon: <RefreshIcon />,
      color: '#3B82F6',
    },
    {
      id: 'build',
      title: 'Build',
      description: 'Build both backend and frontend',
      icon: <BuildIcon />,
      color: '#F59E0B',
    },
    {
      id: 'install',
      title: 'Install Dependencies',
      description: 'Install all project dependencies',
      icon: <TerminalIcon />,
      color: '#8B5CF6',
    },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TerminalIcon />
        Praxis CLI Control Panel
      </Typography>

      {/* Process Status Cards */}
      <Stack direction="row" spacing={3} sx={{ mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Paper
          sx={{
            flex: 1,
            minWidth: 280,
            p: 3,
            bgcolor: 'rgba(16,185,129,0.05)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Backend Server</Typography>
            {getStatusChip(processStatus?.backend?.running || processStatus?.running)}
          </Box>
          {processStatus?.backend && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                PID: {processStatus.backend.pid || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Port: {processStatus.backend.port || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Uptime: {processStatus.backend.uptime || 'N/A'}
              </Typography>
            </Stack>
          )}
        </Paper>

        <Paper
          sx={{
            flex: 1,
            minWidth: 280,
            p: 3,
            bgcolor: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.2)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Frontend Dev Server</Typography>
            {getStatusChip(processStatus?.frontend?.running || processStatus?.running)}
          </Box>
          {processStatus?.frontend && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                PID: {processStatus.frontend.pid || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Port: {processStatus.frontend.port || '3000'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Uptime: {processStatus.frontend.uptime || 'N/A'}
              </Typography>
            </Stack>
          )}
        </Paper>
      </Stack>

      {/* Quick Actions */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Quick Actions
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 4, flexWrap: 'wrap', gap: 2 }}>
        {actions.map(action => (
          <Button
            key={action.id}
            variant="contained"
            startIcon={action.icon}
            onClick={() => handleAction(action.id)}
            disabled={loading}
            sx={{
              bgcolor: action.color,
              '&:hover': { bgcolor: action.color, opacity: 0.9 },
              px: 3,
              py: 1.5,
              fontWeight: 700,
            }}
          >
            {action.title}
          </Button>
        ))}
      </Stack>

      {/* Command Logs */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Recent Commands
      </Typography>
      <Paper
        sx={{
          p: 2,
          bgcolor: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: 400,
          overflow: 'auto',
        }}
      >
        {logs.length === 0 ? (
          <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No commands executed yet
          </Typography>
        ) : (
          <Stack spacing={1}>
            {logs.map((log, index) => (
              <Box
                key={index}
                sx={{
                  p: 1.5,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 1,
                  borderLeft: `3px solid ${
                    log.status === 'success' ? '#10B981' :
                    log.status === 'error' ? '#EF4444' : '#F59E0B'
                  }`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                    {log.command}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Typography>
                </Box>
                <Chip
                  label={log.status.toUpperCase()}
                  size="small"
                  color={log.status === 'success' ? 'success' : log.status === 'error' ? 'error' : 'warning'}
                  sx={{ mb: 1 }}
                />
                {log.output && (
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: log.status === 'error' ? '#F87171' : '#9CA3AF',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {log.output}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Confirm Action: {actions.find(a => a.id === selectedAction)?.title}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actions.find(a => a.id === selectedAction)?.description}
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            This action will be executed on the server. Monitor the logs below for progress.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedAction && executeCommand(selectedAction)}
            variant="contained"
            disabled={loading}
            color="primary"
          >
            {loading ? 'Executing...' : 'Execute'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading indicator */}
      {loading && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0 }} />}

      {/* Snackbar notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Box>
  );
};

export default CLITab;
