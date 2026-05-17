import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../../lib/supabase';

/**
 * Handles Supabase PKCE OAuth callback.
 * Supabase v2 redirects back with ?code=<pkce_code> — must call
 * exchangeCodeForSession() to establish the session.
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const url = window.location.href;
      const params = new URLSearchParams(window.location.search);

      if (params.get('code')) {
        // PKCE flow — exchange authorization code for session
        const { error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          setError(error.message);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }
      }
      // For implicit flow or if session already set — detect via onAuthStateChange
      // Either way: navigate to dashboard; PrivateRoute will guard if not authenticated
      navigate('/dashboard', { replace: true });
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
        <Typography color="error">Login failed: {error}</Typography>
        <Typography variant="caption" color="text.secondary">Redirecting to login…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
      <CircularProgress color="primary" />
      <Typography variant="body2" color="text.secondary">Completing sign-in…</Typography>
    </Box>
  );
};

export default AuthCallback;
