import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Link } from 'react-router-dom';
// import logger from '../../src/utils/logger'; // Removed as this is a frontend component

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
    console.error("Uncaught error:", error, errorInfo); // Log to console
    // logger.error('Frontend Error:', { error: error.message, componentStack: errorInfo.componentStack, stack: error.stack }); // Removed backend logger call
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
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
          }}
        >
          <Paper elevation={3} sx={{ p: 4, maxWidth: 600 }}>
            <Typography variant="h4" color="error" gutterBottom>
              Oops! Something went wrong.
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              We're sorry for the inconvenience. Our team has been notified, and we're working to fix the issue.
            </Typography>
            <Button variant="contained" color="primary" component={Link} to="/" sx={{ mt: 2, mr: 2 }}>
              Go to Home
            </Button>
            <Button variant="outlined" onClick={() => window.location.reload()} sx={{ mt: 2 }}>
              Reload Page
            </Button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 4, textAlign: 'left', p: 2, border: '1px solid #eee', borderRadius: 1, bgcolor: '#f9f9f9' }}>
                <Typography variant="h6">Error Details:</Typography>
                <Typography variant="body2" color="error">
                  {this.state.error.toString()}
                </Typography>
                <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {this.state.errorInfo?.componentStack}
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
