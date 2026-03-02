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
  Menu,
  MenuItem,
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
import SchoolIcon from '@mui/icons-material/School';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BarChartIcon from '@mui/icons-material/BarChart';

const Navbar: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

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
    setProfileMenuAnchor(null);
    setDrawerOpen(false);
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleNav = (path: string) => {
    setProfileMenuAnchor(null);
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
        mr: 3,
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
        PR<Box component="span" sx={{ color: 'primary.main' }}>A</Box>XIS
      </Typography>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ px: { xs: 2, md: 4 }, minHeight: 64 }}>
          {Logo}

          {isMobile ? (
            <Box sx={{ flexGrow: 1 }} />
          ) : (
            /* ── Desktop: primary nav links (3 only) ── */
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
              {user && (
                <>
                  {[
                    { label: 'Dashboard', to: '/dashboard' },
                    { label: 'Matches', to: '/matches' },
                    { label: 'Chat', to: '/communication' },
                  ].map(({ label, to }) => {
                    const active = location.pathname.startsWith(to);
                    return (
                      <Button
                        key={label}
                        component={RouterLink}
                        to={to}
                        sx={{
                          color: active ? 'text.primary' : 'text.secondary',
                          fontWeight: active ? 700 : 500,
                          borderRadius: '8px',
                          px: 1.5,
                          '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.05)' },
                        }}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </>
              )}
            </Box>
          )}

          {/* ── Right side ── */}
          {isMobile ? (
            <IconButton
              onClick={() => setDrawerOpen(true)}
              sx={{ color: 'text.primary' }}
              aria-label="open menu"
            >
              <MenuIcon />
            </IconButton>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {user ? (
                <>
                  {/* Search */}
                  {!hideSearch && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        px: 1.5,
                        py: 0.5,
                        width: 200,
                        transition: 'all 0.2s ease',
                        '&:focus-within': {
                          borderColor: 'primary.main',
                          bgcolor: 'rgba(255,255,255,0.08)',
                          width: 240,
                        },
                      }}
                    >
                      <SearchIcon
                        sx={{ color: 'text.secondary', fontSize: 16, mr: 1, cursor: 'pointer', flexShrink: 0 }}
                        onClick={handleSearchClick}
                      />
                      <InputBase
                        placeholder="Search…"
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                        onKeyDown={handleSearch}
                        inputProps={{ 'aria-label': 'search' }}
                        sx={{ fontSize: '0.8125rem', color: 'text.primary', flex: 1 }}
                      />
                    </Box>
                  )}

                  {/* Streak chip */}
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
                        bgcolor: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        color: '#F59E0B',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}
                    />
                  )}

                  {/* Profile avatar — opens dropdown */}
                  <IconButton
                    onClick={(e) => setProfileMenuAnchor(e.currentTarget)}
                    sx={{ p: 0.5 }}
                    aria-label="account menu"
                  >
                    <Avatar
                      src={user.avatarUrl || undefined}
                      sx={{
                        width: 34,
                        height: 34,
                        border: '2px solid rgba(245,158,11,0.35)',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                      }}
                    >
                      {user.name?.charAt(0).toUpperCase()}
                    </Avatar>
                  </IconButton>

                  {/* Profile dropdown menu */}
                  <Menu
                    anchorEl={profileMenuAnchor}
                    open={Boolean(profileMenuAnchor)}
                    onClose={() => setProfileMenuAnchor(null)}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    slotProps={{
                      paper: {
                        sx: {
                          mt: 1,
                          minWidth: 200,
                          bgcolor: '#1F2937',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '14px',
                          overflow: 'hidden',
                        },
                      },
                    }}
                  >
                    {/* User info header */}
                    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                    </Box>

                    <MenuItem onClick={() => handleNav(`/profile/${user.id}`)} sx={{ gap: 1.5, py: 1.25 }}>
                      <AccountCircleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">My Profile</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/analytics')} sx={{ gap: 1.5, py: 1.25 }}>
                      <BarChartIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Analytics</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/coaching')} sx={{ gap: 1.5, py: 1.25 }}>
                      <SchoolIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Coaching</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/marketplace')} sx={{ gap: 1.5, py: 1.25 }}>
                      <StorefrontIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Marketplace</Typography>
                    </MenuItem>

                    {user.is_admin && (
                      <MenuItem onClick={() => handleNav('/admin')} sx={{ gap: 1.5, py: 1.25 }}>
                        <AdminPanelSettingsIcon fontSize="small" sx={{ color: 'error.main' }} />
                        <Typography variant="body2" color="error.main" fontWeight={700}>Admin</Typography>
                      </MenuItem>
                    )}

                    <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />

                    <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1.25 }}>
                      <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
                      <Typography variant="body2" color="error.main">Sign out</Typography>
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <>
                  <Button
                    component={RouterLink}
                    to="/login"
                    sx={{ color: 'text.secondary', fontWeight: 500, '&:hover': { color: 'text.primary' } }}
                  >
                    Login
                  </Button>
                  <Button
                    variant="contained"
                    component={RouterLink}
                    to="/signup"
                    sx={{ ml: 0.5 }}
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>Menu</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {user ? (
          <>
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
              {[
                { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon /> },
                { label: 'Matches', to: '/matches', icon: <ExploreIcon /> },
                { label: 'Chat', to: '/communication', icon: <ChatIcon /> },
                { label: 'Coaching', to: '/coaching', icon: <SchoolIcon /> },
                { label: 'Marketplace', to: '/marketplace', icon: <StorefrontIcon /> },
                { label: 'Analytics', to: '/analytics', icon: <BarChartIcon /> },
                { label: 'My Profile', to: `/profile/${user.id}`, icon: <AccountCircleIcon /> },
              ].map(({ label, to, icon }) => (
                <ListItem key={label} disablePadding>
                  <ListItemButton onClick={() => handleNav(to)}>
                    <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>{icon}</ListItemIcon>
                    <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9375rem' }} />
                  </ListItemButton>
                </ListItem>
              ))}
              {user.is_admin && (
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleNav('/admin')}>
                    <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}><AdminPanelSettingsIcon /></ListItemIcon>
                    <ListItemText primary="Admin" primaryTypographyProps={{ fontWeight: 700, color: 'error.main' }} />
                  </ListItemButton>
                </ListItem>
              )}
            </List>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 1 }} />

            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton onClick={handleLogout}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}><LogoutIcon /></ListItemIcon>
                  <ListItemText primary="Sign out" primaryTypographyProps={{ fontWeight: 600, color: 'error.main' }} />
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
