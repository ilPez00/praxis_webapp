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

const SignupForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const response = await axios.post('http://localhost:3001/auth/signup', {
        email, password, name, age: parseInt(age), bio,
      });
      setIsError(false);
      setMessage(response.data.message);
      navigate('/login');
    } catch (error: any) {
      setIsError(true);
      setMessage(error.response?.data?.message || 'Signup failed.');
    }
  };

  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) { setIsError(true); setMessage(error.message); }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Left brand panel */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' },
        flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, transparent 70%), #0D0E1A',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        p: 6, textAlign: 'center',
      }}>
        <Typography variant="h2" sx={{
          fontWeight: 800, mb: 2,
          background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
          backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          PRAXIS
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1.5 }}>
          Join the movement
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 300, lineHeight: 1.7 }}>
          Connect with people who share your exact goals and ambitions.
        </Typography>
      </Box>

      {/* Right form panel */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        p: { xs: 3, md: 6 },
        overflowY: 'auto',
      }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>Create account</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Start your goal-aligned journey today.
          </Typography>

          {message && <Alert severity={isError ? 'error' : 'success'} sx={{ mb: 3 }}>{message}</Alert>}

          <Box component="form" onSubmit={handleSignup} noValidate>
            <Stack spacing={2}>
              <TextField fullWidth required label="Full Name" autoComplete="name" autoFocus
                value={name} onChange={(e) => setName(e.target.value)} />
              <TextField fullWidth required label="Email Address" type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextField fullWidth required label="Password" type="password" autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <TextField fullWidth required label="Age" type="number" inputProps={{ min: 13, max: 120 }}
                value={age} onChange={(e) => setAge(e.target.value)} />
              <TextField fullWidth required label="Short Bio" multiline rows={3} placeholder="What drives you?"
                value={bio} onChange={(e) => setBio(e.target.value)} />
            </Stack>

            <Button
              type="submit" fullWidth variant="contained" color="primary"
              endIcon={<ArrowForwardIcon />}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              Create Account
            </Button>

            <Divider sx={{ my: 2, color: 'text.disabled', fontSize: '0.75rem' }}>or</Divider>

            <Button
              fullWidth variant="outlined" color="primary"
              onClick={handleGoogleSignup}
              startIcon={<GoogleIcon />}
              sx={{ mb: 3, py: 1.25 }}
            >
              Sign up with Google
            </Button>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              Already have an account?{' '}
              <MuiLink component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
                Sign in
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SignupForm;
