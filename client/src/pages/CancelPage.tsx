import React from 'react';
import { Container, Typography, Button, Alert, Paper } from '@mui/material'; // Import Paper and Alert
import CancelIcon from '@mui/icons-material/Cancel'; // Icon to indicate cancellation
import { useNavigate } from 'react-router-dom'; // Hook for programmatic navigation

/**
 * @description Page displayed when a user cancels the Stripe Checkout process.
 * It informs the user that their subscription was not completed.
 */
const CancelPage: React.FC = () => {
  const navigate = useNavigate(); // Initialize navigate hook

  // Render the cancellation page UI
  return (
    <Container component="main" maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        {/* Display a cancellation icon */}
        <CancelIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom>
          Subscription Canceled
        </Typography>
        {/* Inform the user that no charge was made */}
        <Alert severity="warning" sx={{ mb: 3 }}>
          Your subscription process was canceled. You have not been charged.
        </Alert>
        {/* Buttons for user actions */}
        <Button variant="contained" color="primary" onClick={() => navigate('/upgrade')}>
          Try Again
        </Button>
        <Button variant="outlined" sx={{ ml: 2 }} onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </Button>
      </Paper>
    </Container>
  );
};

export default CancelPage;