import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Link as MuiLink,
  Alert,
  Divider,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GoogleIcon from '@mui/icons-material/Google';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await axios.post('http://localhost:3001/auth/login', { email, password });
      setIsError(false);
      setMessage(response.data.message);
      const userId = response.data.user.id;
      localStorage.setItem('userId', userId);
      navigate(`/profile/${userId}`);
    } catch (error: any) {
      setIsError(true);
      setMessage(error.response?.data?.message || 'Login failed.');
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) { setIsError(true); setMessage(error.message); }
  };

  return (
    <Box sx={{
      display: 'flex', minHeight: 'calc(100vh - 64px)',
    }}>
      {/* Left brand panel */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.12) 0%, transparent 70%), #0D0E1A',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        p: 6, textAlign: 'center',
      }}>
        <Typography variant="h2" sx={{
          fontWeight: 800, mb: 2,
          background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
          backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          PRAXIS
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 320, lineHeight: 1.7 }}>
          Your goals. Your connections. Your growth.
        </Typography>
        <Box sx={{ mt: 6, display: 'flex', flexDirection: 'column', gap: 3, width: '100%', maxWidth: 300 }}>
          {['AI-powered goal matching', 'Peer accountability network', 'Structured progress tracking'].map((feat) => (
            <Box key={feat} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', boxShadow: '0 0 8px #F59E0B', flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary">{feat}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right form panel */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        p: { xs: 3, md: 6 },
      }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>Welcome back</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Sign in to continue your journey.
          </Typography>

          {message && <Alert severity={isError ? 'error' : 'success'} sx={{ mb: 3 }}>{message}</Alert>}

          <Box component="form" onSubmit={handleLogin} noValidate>
            <Stack spacing={2}>
              <TextField
                fullWidth required label="Email Address" type="email"
                autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                fullWidth required label="Password" type="password"
                autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </Stack>

            <Button
              type="submit" fullWidth variant="contained" color="primary"
              endIcon={<ArrowForwardIcon />}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              Sign In
            </Button>

            <Divider sx={{ my: 2, color: 'text.disabled', fontSize: '0.75rem' }}>or</Divider>

            <Button
              fullWidth variant="outlined" color="primary"
              onClick={handleGoogleLogin}
              startIcon={<GoogleIcon />}
              sx={{ mb: 3, py: 1.25 }}
            >
              Continue with Google
            </Button>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Don't have an account?{' '}
              <MuiLink component={RouterLink} to="/signup" sx={{ fontWeight: 600 }}>
                Sign up free
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginForm;
