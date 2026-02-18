import React from 'react';
import { Container, Typography, Box, Button, Alert } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';

const CancelPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container component="main" maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <CancelIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom>
          Subscription Canceled
        </Typography>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Your subscription process was canceled. You have not been charged.
        </Alert>
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