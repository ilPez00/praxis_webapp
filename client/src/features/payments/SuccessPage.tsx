import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, CircularProgress, Alert, Button, Paper } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios'; // axios is imported but not used, can be removed if not needed

/**
 * @description Page displayed after a successful return from Stripe Checkout.
 * It informs the user about the subscription status.
 */
const SuccessPage: React.FC = () => {
  const location = useLocation(); // Hook to access the URL's query parameters
  const navigate = useNavigate(); // Hook to programmatically navigate
  const [loading, setLoading] = useState(true); // State to manage loading status
  const [message, setMessage] = useState(''); // State to store display message
  const [severity, setSeverity] = useState<'success' | 'error' | 'info'>('info'); // State for Alert severity

  useEffect(() => {
    const query = new URLSearchParams(location.search); // Parse URL query parameters
    const sessionId = query.get('session_id'); // Get the session_id from the URL

    // Check if a session_id is present in the URL, indicating a successful return from Stripe
    if (sessionId) {
      // In a real production application, it's crucial to verify this session_id
      // on your backend server. This would involve making an API call to your backend
      // with the sessionId, and your backend would then query Stripe to confirm
      // the session's validity and completion status. This prevents users from
      // faking success pages.
      // For this example, we proceed assuming success.
      setMessage('Your subscription was successful! Welcome to Premium.');
      setSeverity('success');
    } else {
      // If no session_id, the success status is ambiguous
      setMessage('Subscription success status unknown. Please check your account or contact support.');
      setSeverity('info');
    }
    setLoading(false); // Once status is determined, stop loading
  }, [location]); // Re-run effect if URL location changes

  // Render loading state or the success/info/error message
  return (
    <Container component="main" maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {loading ? (
          // Show a loading spinner while checking session status
          <CircularProgress />
        ) : (
          <>
            {/* Display appropriate icon based on severity */}
            {severity === 'success' && <CheckCircleOutlineIcon color="success" sx={{ fontSize: 60, mb: 2 }} />}
            {(severity === 'error' || severity === 'info') && <ErrorOutlineIcon color="info" sx={{ fontSize: 60, mb: 2 }} />}
            <Typography variant="h4" component="h1" gutterBottom>
              {severity === 'success' ? 'Subscription Successful!' : 'Subscription Status'}
            </Typography>
            <Alert severity={severity} sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Button variant="contained" color="primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default SuccessPage;