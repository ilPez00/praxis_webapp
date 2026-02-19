import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Avatar,
  Chip,
  useTheme,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';

const Navbar: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ px: { xs: 2, md: 4 }, minHeight: 64 }}>
        {/* Logo */}
        <Box
          component={RouterLink}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            textDecoration: 'none',
            flexGrow: 1,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(245,158,11,0.4)',
            }}
          >
            <BoltIcon sx={{ color: '#0A0B14', fontSize: 18, fontWeight: 900 }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'text.primary',
            }}
          >
            PR
            <Box component="span" sx={{ color: 'primary.main' }}>
              A
            </Box>
            XIS
          </Typography>
        </Box>

        {/* Nav actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {user ? (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/dashboard"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/matches"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Matches
              </Button>

              {/* Avatar pill — links to profile */}
              <Chip
                component={RouterLink}
                to={`/profile/${user.id}`}
                avatar={
                  <Avatar src={user.avatarUrl || undefined} sx={{ width: 28, height: 28 }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </Avatar>
                }
                label={user.name?.split(' ')[0] || 'Profile'}
                clickable
                sx={{
                  ml: 1,
                  px: 0.5,
                  bgcolor: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'text.primary',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                }}
              />

              <Button
                variant="outlined"
                size="small"
                onClick={handleLogout}
                sx={{ ml: 1, borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/login"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Login
              </Button>
              <Button
                variant="contained"
                component={RouterLink}
                to="/signup"
                sx={{ ml: 1 }}
              >
                Get Started
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
