import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
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
  InputBase,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ExploreIcon from '@mui/icons-material/Explore';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ChatIcon from '@mui/icons-material/Chat';
import GroupsIcon from '@mui/icons-material/Groups';
import SchoolIcon from '@mui/icons-material/School';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SearchIcon from '@mui/icons-material/Search';

const Navbar: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Hide search on profile pages
  const hideSearch = /^\/profile(\/|$)/.test(location.pathname);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}&type=all`);
      setSearchValue('');
      setDrawerOpen(false);
    }
  };

  const handleSearchClick = () => {
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}&type=all`);
      setSearchValue('');
      setDrawerOpen(false);
    }
  };

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
                  <Button
                    color="inherit"
                    component={RouterLink}
                    to="/chat"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    Chat
                  </Button>
                  <Button
                    color="inherit"
                    component={RouterLink}
                    to="/groups"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    Groups
                  </Button>
                  <Button
                    color="inherit"
                    component={RouterLink}
                    to="/coaching"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    Coaching
                  </Button>
                  <Button
                    color="inherit"
                    component={RouterLink}
                    to="/marketplace"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    Marketplace
                  </Button>
                  {!hideSearch && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        bgcolor: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        px: 1.5,
                        py: 0.5,
                        ml: 1,
                        width: 220,
                        '&:focus-within': { borderColor: 'primary.main', bgcolor: 'rgba(255,255,255,0.09)' },
                      }}
                    >
                      <SearchIcon
                        sx={{ color: 'text.secondary', fontSize: 18, mr: 1, cursor: 'pointer' }}
                        onClick={handleSearchClick}
                      />
                      <InputBase
                        placeholder="Search…"
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                        onKeyDown={handleSearch}
                        inputProps={{ 'aria-label': 'search' }}
                        sx={{ fontSize: '0.875rem', color: 'text.primary', flex: 1 }}
                      />
                    </Box>
                  )}
                  {(user.current_streak ?? 0) > 0 && (
                    <Chip
                      icon={
                        <LocalFireDepartmentIcon sx={{
                          color: '#F59E0B !important',
                          '@keyframes flamePulse': {
                            '0%':   { transform: 'scale(1)',    filter: 'drop-shadow(0 0 3px #F59E0B)' },
                            '50%':  { transform: 'scale(1.25)', filter: 'drop-shadow(0 0 8px #F59E0B)' },
                            '100%': { transform: 'scale(1)',    filter: 'drop-shadow(0 0 3px #F59E0B)' },
                          },
                          animation: 'flamePulse 2s ease-in-out infinite',
                        }} />
                      }
                      label={`${user.current_streak}d`}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        color: '#F59E0B',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    />
                  )}
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
            {/* Search in mobile drawer */}
            {!hideSearch && (
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    px: 1.5,
                    py: 0.5,
                    '&:focus-within': { borderColor: 'primary.main' },
                  }}
                >
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 18, mr: 1, cursor: 'pointer' }} onClick={handleSearchClick} />
                  <InputBase
                    placeholder="Search…"
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                    onKeyDown={handleSearch}
                    inputProps={{ 'aria-label': 'search' }}
                    sx={{ fontSize: '0.875rem', color: 'text.primary', flex: 1 }}
                  />
                </Box>
              </Box>
            )}

            {/* User info */}
            <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar src={user.avatarUrl || undefined} sx={{ width: 44, height: 44, border: '2px solid rgba(245,158,11,0.4)' }}>
                {user.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{user.name}</Typography>
                  {(user.current_streak ?? 0) > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <LocalFireDepartmentIcon sx={{
                        fontSize: 16,
                        color: '#F59E0B',
                        '@keyframes flamePulse': {
                          '0%':   { transform: 'scale(1)',    filter: 'drop-shadow(0 0 3px #F59E0B)' },
                          '50%':  { transform: 'scale(1.25)', filter: 'drop-shadow(0 0 8px #F59E0B)' },
                          '100%': { transform: 'scale(1)',    filter: 'drop-shadow(0 0 3px #F59E0B)' },
                        },
                        animation: 'flamePulse 2s ease-in-out infinite',
                      }} />
                      <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700 }}>
                        {user.current_streak}d
                      </Typography>
                    </Box>
                  )}
                </Box>
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
                <ListItemButton onClick={() => handleNav('/chat')}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><ChatIcon /></ListItemIcon>
                  <ListItemText primary="Chat" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/groups')}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><GroupsIcon /></ListItemIcon>
                  <ListItemText primary="Groups" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/coaching')}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><SchoolIcon /></ListItemIcon>
                  <ListItemText primary="Coaching" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNav('/marketplace')}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><StorefrontIcon /></ListItemIcon>
                  <ListItemText primary="Marketplace" primaryTypographyProps={{ fontWeight: 600 }} />
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
