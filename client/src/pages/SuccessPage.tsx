import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, CircularProgress, Alert, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const SuccessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const sessionId = query.get('session_id');

    if (sessionId) {
      // In a real application, you might want to verify the session on your backend
      // for security reasons, rather than just relying on the client-side session_id.
      // For this example, we assume success.
      setMessage('Your subscription was successful! Welcome to Premium.');
      setSeverity('success');
    } else {
      setMessage('Subscription success status unknown. Please check your account.');
      setSeverity('info');
    }
    setLoading(false);
  }, [location]);

  return (
    <Container component="main" maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {loading ? (
          <CircularProgress />
        ) : (
          <>
            {severity === 'success' && <CheckCircleOutlineIcon color="success" sx={{ fontSize: 60, mb: 2 }} />}
            {severity === 'error' && <ErrorOutlineIcon color="error" sx={{ fontSize: 60, mb: 2 }} />}
            {severity === 'info' && <ErrorOutlineIcon color="info" sx={{ fontSize: 60, mb: 2 }} />}
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