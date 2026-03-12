import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { nuclearReset } from '../utils/versionControl';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * @class ErrorBoundary
 * @extends Component
 * @description React Error Boundary component to catch JavaScript errors
 * anywhere in their child component tree, log those errors, and display a fallback UI.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
  };

  /**
   * @description This static method is called after an error has been thrown by a descendant component.
   * It receives the error that was thrown as a parameter. This method should return an object to update state.
   */
  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  /**
   * @description This method is called after an error has been thrown by a descendant component.
   * It receives two parameters: error and errorInfo.
   */
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
              A critical error occurred, likely due to outdated browser cache after a system update. 
              Try a regular reload first, or use <strong>Hard Reset</strong> to clear all local data.
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
                Hard Reset (Clear Cache)
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

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 4, textAlign: 'left', p: 2, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2, bgcolor: 'rgba(0,0,0,0.2)' }}>
                <Typography variant="caption" color="error" sx={{ fontFamily: 'monospace' }}>
                  {this.state.error.toString()}
                </Typography>
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
