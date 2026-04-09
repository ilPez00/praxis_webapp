import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/Home';

const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? 'Page not found' : `Error ${error.status}`;
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', p: 3 }}>
      <Paper sx={{ p: 4, maxWidth: 480, textAlign: 'center', borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{message}</Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
          <Button
            variant="outlined"
            startIcon={<HomeIcon />}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default RouteErrorBoundary;
