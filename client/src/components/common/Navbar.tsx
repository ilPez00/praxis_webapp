import React, { useState } from 'react';
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
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExploreIcon from '@mui/icons-material/Explore';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

const Navbar: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleNav = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  const Logo = (
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
  );

  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ px: { xs: 2, md: 4 }, minHeight: 64 }}>
          {Logo}

          {isMobile ? (
            /* ── Mobile: hamburger ── */
            <IconButton
              onClick={() => setDrawerOpen(true)}
              sx={{ color: 'text.primary', ml: 1 }}
              aria-label="open menu"
            >
              <MenuIcon />
            </IconButton>
          ) : (
            /* ── Desktop: inline nav ── */
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
          )}
        </Toolbar>
      </AppBar>

      {/* ── Mobile Drawer ── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: '#111827',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      >
        {/* Drawer header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>Menu</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {user ? (
          <>
            {/* User info */}
            <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar src={user.avatarUrl || undefined} sx={{ width: 44, height: 44, border: '2px solid rgba(245,158,11,0.4)' }}>
                {user.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>{user.name}</Typography>
                <Typography variant="caption" color="text.secondary">{user.email}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/dashboard')}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><DashboardIcon /></ListItemIcon>
                  <ListItemText primary="Dashboard" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/matches')}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><ExploreIcon /></ListItemIcon>
                  <ListItemText primary="Matches" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav(`/profile/${user.id}`)}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><AccountCircleIcon /></ListItemIcon>
                  <ListItemText primary="Profile" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
            </List>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 1 }} />

            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton onClick={handleLogout}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}><LogoutIcon /></ListItemIcon>
                  <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 600, color: 'error.main' }} />
                </ListItemButton>
              </ListItem>
            </List>
          </>
        ) : (
          <List disablePadding sx={{ pt: 1 }}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNav('/login')}>
                <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><LoginIcon /></ListItemIcon>
                <ListItemText primary="Login" primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNav('/signup')}>
                <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}><PersonAddIcon /></ListItemIcon>
                <ListItemText primary="Get Started" primaryTypographyProps={{ fontWeight: 700, color: 'primary.main' }} />
              </ListItemButton>
            </ListItem>
          </List>
        )}
      </Drawer>
    </>
  );
};

export default Navbar;
