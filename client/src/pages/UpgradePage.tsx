import React, { useState } from 'react';
import { Container, Box, Typography, Button, Paper, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { useUser } from '../hooks/useUser';

// Make sure to call loadStripe outside of a component’s render to avoid recreating the Stripe object on every render.
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY as string);

const UpgradePage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgradeClick = async () => {
    if (!user || userLoading) {
      setError('You must be logged in to upgrade.');
      return;
    }

    setLoadingCheckout(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:3001/stripe/create-checkout-session', {
        userId: user.id,
        email: user.email, // Pass user email for pre-filling Stripe Checkout
      });

      const { url } = response.data;
      if (url) {
        window.location.href = url; // Redirect to Stripe Checkout
      } else {
        setError('Failed to get checkout URL from server.');
      }
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(err.response?.data?.error || 'Failed to initiate upgrade process.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (userLoading) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Upgrade to Premium
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary">
          Unlock exclusive features and enhance your Praxis experience!
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ my: 2 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Monthly Plan: $10.00
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Billed monthly. Cancel anytime.
          </Typography>
        </Box>

        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleUpgradeClick}
          disabled={loadingCheckout || !user}
        >
          {loadingCheckout ? <CircularProgress size={24} color="inherit" /> : 'Upgrade Now'}
        </Button>
      </Paper>
    </Container>
  );
};

export default UpgradePage;