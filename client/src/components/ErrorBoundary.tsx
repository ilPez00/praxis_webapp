import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Stack, Collapse } from '@mui/material';
import { nuclearReset } from '../utils/versionControl';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  showDetails: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by boundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            textAlign: 'center',
            p: 3,
            background: 'radial-gradient(circle at center, #111827 0%, #0A0B14 100%)',
          }}
        >
          <Paper 
            elevation={24} 
            sx={{ 
              p: 5, 
              maxWidth: 500, 
              borderRadius: '24px', 
              bgcolor: 'rgba(17, 24, 39, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
          >
            <Box sx={{ 
              width: 64, height: 64, borderRadius: '20px', 
              bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 3
            }}>
              <RestartAltIcon sx={{ fontSize: 40 }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5, letterSpacing: '-0.02em' }}>
              Interface Reset Required
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
              A critical error occurred. This often happens after a major system update when the browser tries to use old cached files. 
              Use <strong>Hard Reset</strong> to clear all local data.
            </Typography>

            <Stack spacing={2}>
              <Button 
                fullWidth
                variant="contained" 
                color="primary" 
                startIcon={<RefreshIcon />}
                onClick={() => window.location.reload()} 
                sx={{ borderRadius: '12px', py: 1.5, fontWeight: 800 }}
              >
                Reload Page
              </Button>

              <Button 
                fullWidth
                variant="outlined" 
                color="warning" 
                startIcon={<RestartAltIcon />}
                onClick={() => nuclearReset()}
                sx={{ borderRadius: '12px', py: 1.5, fontWeight: 800, borderColor: 'rgba(245, 158, 11, 0.3)' }}
              >
                Hard Reset (Nuclear)
              </Button>

              <Button 
                fullWidth
                variant="text" 
                startIcon={<HomeIcon />}
                onClick={() => window.location.href = '/'} 
                sx={{ color: 'text.disabled', fontWeight: 700 }}
              >
                Back to Login
              </Button>
            </Stack>

            {this.state.error && (
              <Box sx={{ mt: 4, textAlign: 'left' }}>
                <Button 
                  size="small" 
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  startIcon={<ExpandMoreIcon sx={{ transform: this.state.showDetails ? 'rotate(180deg)' : 'none' }} />}
                  sx={{ color: 'text.disabled', fontSize: '0.65rem' }}
                >
                  Technical Details
                </Button>
                <Collapse in={this.state.showDetails}>
                  <Box sx={{ 
                    mt: 1, p: 2, 
                    border: '1px solid rgba(255,255,255,0.05)', 
                    borderRadius: 2, bgcolor: 'rgba(0,0,0,0.2)',
                    maxHeight: 200, overflow: 'auto'
                  }}>
                    <Typography variant="caption" color="error" sx={{ fontFamily: 'monospace', display: 'block', mb: 1 }}>
                      {this.state.error.name}: {this.state.error.message}
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled', fontSize: '0.6rem', whiteSpace: 'pre-wrap' }}>
                      {this.state.error.stack}
                    </Typography>
                  </Box>
                </Collapse>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
