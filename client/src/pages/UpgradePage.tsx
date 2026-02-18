import React, { useState } from 'react';
import { Container, Box, Typography, Button, Paper, CircularProgress, Alert } from '@mui/material';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { useUser } from '../hooks/useUser';

// Initialize Stripe.js with the publishable key.
// This is done outside the component render to ensure it's loaded only once
// and to avoid re-creating the Stripe object on every re-render, which is a Stripe best practice.
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY as string);

/**
 * @description Page component for users to upgrade to premium features.
 * It initiates a Stripe Checkout Session via the backend.
 */
const UpgradePage: React.FC = () => {
  // Access the current authenticated user and loading status from the custom hook
  const { user, loading: userLoading } = useUser();
  // State to manage loading status during checkout initiation
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  // State to store and display any error messages
  const [error, setError] = useState<string | null>(null);

  /**
   * @description Handles the click event for the "Upgrade Now" button.
   * It calls the backend to create a Stripe Checkout Session and redirects the user.
   */
  const handleUpgradeClick = async () => {
    // Prevent upgrade if user is not logged in or user data is still loading
    if (!user || userLoading) {
      setError('You must be logged in to upgrade.');
      return;
    }

    setLoadingCheckout(true); // Indicate that checkout process is starting
    setError(null); // Clear previous errors

    try {
      // Call the backend API to create a new Stripe Checkout Session
      const response = await axios.post('http://localhost:3001/stripe/create-checkout-session', {
        userId: user.id, // Pass the user's ID to the backend
        email: user.email, // Pass the user's email to pre-fill Stripe Checkout
      });

      const { url } = response.data; // Extract the redirect URL from the backend response
      if (url) {
        window.location.href = url; // Redirect the user to Stripe's hosted checkout page
      } else {
        setError('Failed to get checkout URL from server.'); // Handle case where URL is missing
      }
    } catch (err: any) {
      // Log and display any errors during the checkout session creation
      console.error('Error creating checkout session:', err);
      setError(err.response?.data?.error || 'Failed to initiate upgrade process.');
    } finally {
      setLoadingCheckout(false); // Reset loading state
    }
  };

  // Display a loading spinner while user data is being fetched
  if (userLoading) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Render the upgrade page UI
  return (
    <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Upgrade to Premium
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary">
          Unlock exclusive features and enhance your Praxis experience!
        </Typography>

        {/* Display error messages if any */}
        {error && <Alert severity="error">{error}</Alert>}

        {/* Display plan details */}
        <Box sx={{ my: 2 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Monthly Plan: $10.00
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Billed monthly. Cancel anytime.
          </Typography>
        </Box>

        {/* Upgrade button */}
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleUpgradeClick}
          // Disable button while checkout is loading or if user is not logged in
          disabled={loadingCheckout || !user}
        >
          {/* Show loading spinner in button if checkout is in progress */}
          {loadingCheckout ? <CircularProgress size={24} color="inherit" /> : 'Upgrade Now'}
        </Button>
      </Paper>
    </Container>
  );
};

export default UpgradePage;