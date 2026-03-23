import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
  children: React.ReactNode;
  /** Optional fallback UI. Pass null to silently hide a failed widget. */
  fallback?: React.ReactNode;
  /** Label shown in compact widget fallback (e.g. "Morning Brief") */
  label?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/** Compact fallback for widgets/cards — shows inline retry instead of full-page error */
export const WidgetFallback: React.FC<{ label?: string; onRetry?: () => void }> = ({ label, onRetry }) => (
  <Box sx={{
    p: 2, borderRadius: '16px', textAlign: 'center',
    border: '1px solid rgba(239,68,68,0.15)',
    bgcolor: 'rgba(239,68,68,0.04)',
  }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      {label ? `${label} couldn't load` : 'This section couldn\'t load'}
    </Typography>
    {onRetry && (
      <Button size="small" startIcon={<RefreshIcon />} onClick={onRetry}
        sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
        Retry
      </Button>
    )}
  </Box>
);

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided (including null), use it
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      // If label is set, show compact widget fallback with retry
      if (this.props.label) {
        return <WidgetFallback label={this.props.label} onRetry={this.handleRetry} />;
      }
      // Default full-page error view
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: 2,
            px: 3,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
          >
            Reload page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
