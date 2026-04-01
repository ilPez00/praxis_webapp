import React, { useEffect, useState } from 'react';
import { Container, Typography, CircularProgress, Alert, Button, Paper, Box } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../lib/api';

/**
 * @description Page displayed after a successful return from Stripe Checkout.
 * It verifies the session server-side before confirming success.
 */
const SuccessPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'success' | 'error' | 'info'>('info');
  const [subscriptionDetails, setSubscriptionDetails] = useState<{
    plan?: string;
    status?: string;
    periodEnd?: string;
  } | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      const query = new URLSearchParams(location.search);
      const sessionId = query.get('session_id');

      if (!sessionId) {
        setMessage('No session ID found. Please contact support.');
        setSeverity('error');
        setLoading(false);
        return;
      }

      try {
        // Verify session server-side
        const response = await api.get('/stripe/verify-session', {
          params: { session_id: sessionId },
        });

        const { status, subscription } = response.data;

        if (status === 'paid' || subscription?.status === 'active') {
          setMessage('Your subscription was successful! Welcome to Premium.');
          setSeverity('success');
          setSubscriptionDetails({
            plan: subscription?.plan || 'Premium',
            status: subscription?.status || 'active',
            periodEnd: subscription?.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
              : undefined,
          });
        } else {
          setMessage('Payment status: ' + status + '. Please contact support if this seems incorrect.');
          setSeverity('info');
        }
      } catch (err: any) {
        setMessage('Verification failed: ' + (err.response?.data?.message || err.message));
        setSeverity('error');
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [location]);

  // Render loading state or the success/info/error message
  return (
    <Container component="main" maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {loading ? (
          <Box sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Verifying your payment...
            </Typography>
          </Box>
        ) : (
          <>
            {severity === 'success' && <CheckCircleOutlineIcon color="success" sx={{ fontSize: 60, mb: 2 }} />}
            {(severity === 'error' || severity === 'info') && <ErrorOutlineIcon color="info" sx={{ fontSize: 60, mb: 2 }} />}
            <Typography variant="h4" component="h1" gutterBottom>
              {severity === 'success' ? 'Subscription Successful!' : 'Subscription Status'}
            </Typography>
            <Alert severity={severity} sx={{ mb: 3 }}>
              {message}
            </Alert>
            
            {subscriptionDetails && (
              <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'rgba(245,158,11,0.05)', borderColor: 'primary.main' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  {subscriptionDetails.plan}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {subscriptionDetails.status}
                </Typography>
                {subscriptionDetails.periodEnd && (
                  <Typography variant="body2" color="text.secondary">
                    Next billing: {subscriptionDetails.periodEnd}
                  </Typography>
                )}
              </Paper>
            )}

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