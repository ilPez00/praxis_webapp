import React, { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
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
  Badge,
  Popover,
  Stack,
  Tooltip,
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
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import PeopleIcon from '@mui/icons-material/People';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import SettingsIcon from '@mui/icons-material/Settings';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notifIcon(type: string): string {
  if (type === 'message' || type === 'group_message') return '💬';
  if (type === 'verification') return '✅';
  if (type === 'honor') return '🏅';
  if (type === 'bet_result') return '🎲';
  if (type === 'match') return '🤝';
  return '🔔';
}

const Navbar: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  // New matches indicator — true if user hasn't visited /matches in 24h
  const [showMatchesBadge, setShowMatchesBadge] = useState(() => {
    const last = localStorage.getItem('praxis_matches_last_visit');
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > 24 * 60 * 60 * 1000;
  });
  // Notifications
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch notifications + subscribe to realtime inserts
  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [notifsRes, countRes] = await Promise.all([
          fetch(`${API_URL}/notifications`, { headers }),
          fetch(`${API_URL}/notifications/unread-count`, { headers }),
        ]);
        if (notifsRes.ok) setNotifications(await notifsRes.json());
        if (countRes.ok) { const d = await countRes.json(); setUnreadCount(d.count ?? 0); }
      } catch { /* silently ignore */ }
    };

    fetchNotifs();

    // Realtime: subscribe to new notifications for this user
    const channel = supabase
      .channel(`notifs_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as AppNotification;
        setNotifications(prev => [n, ...prev].slice(0, 50));
        setUnreadCount(c => c + 1);
      })
      .subscribe();

    notifChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleOpenNotifs = async (e: React.MouseEvent<HTMLElement>) => {
    setNotifAnchor(e.currentTarget);
    // Mark all as read on open
    if (unreadCount > 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        await fetch(`${API_URL}/notifications/read-all`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } catch { /* ignore */ }
    }
  };

  const handleDeleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch(`${API_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  };

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
            /* ── Desktop: primary nav links + More dropdown ── */
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
              {user && (
                <>
                  {[
                    { label: 'Dashboard', to: '/dashboard' },
                    { label: 'Matches', to: '/matches' },
                    { label: 'Chat', to: '/communication' },
                  ].map(({ label, to }) => {
                    const active = location.pathname.startsWith(to);
                    const isMatches = to === '/matches';
                    return (
                      <Button
                        key={label}
                        component={RouterLink}
                        to={to}
                        onClick={() => {
                          if (isMatches) {
                            localStorage.setItem('praxis_matches_last_visit', String(Date.now()));
                            setShowMatchesBadge(false);
                          }
                        }}
                        sx={{
                          color: active ? 'primary.main' : 'text.secondary',
                          fontWeight: active ? 700 : 500,
                          borderRadius: '8px',
                          px: 1.5,
                          position: 'relative',
                          borderBottom: active ? '2px solid' : '2px solid transparent',
                          borderColor: active ? 'primary.main' : 'transparent',
                          borderBottomLeftRadius: 0,
                          borderBottomRightRadius: 0,
                          '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.04)' },
                        }}
                      >
                        {label}
                        {isMatches && showMatchesBadge && !active && (
                          <Box sx={{
                            position: 'absolute', top: 6, right: 6,
                            width: 7, height: 7, borderRadius: '50%',
                            bgcolor: '#F59E0B',
                            boxShadow: '0 0 6px #F59E0B',
                            animation: 'pulse 2s infinite',
                            '@keyframes pulse': {
                              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                              '50%': { opacity: 0.5, transform: 'scale(1.4)' },
                            },
                          }} />
                        )}
                      </Button>
                    );
                  })}
                  {/* More dropdown — secondary nav items */}
                  <Button
                    onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
                    endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '1rem !important', opacity: 0.7, transition: 'transform 0.2s', transform: Boolean(moreMenuAnchor) ? 'rotate(180deg)' : 'none' }} />}
                    sx={{ color: 'text.secondary', fontWeight: 500, borderRadius: '8px', px: 1.5, '&:hover': { color: 'text.primary', bgcolor: 'rgba(255,255,255,0.05)' } }}
                  >
                    More
                  </Button>
                  <Menu
                    anchorEl={moreMenuAnchor}
                    open={Boolean(moreMenuAnchor)}
                    onClose={() => setMoreMenuAnchor(null)}
                    transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
                    slotProps={{ paper: { sx: { mt: 1, minWidth: 180, bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' } } }}
                  >
                    {[
                      { label: 'Challenges', to: '/challenges', icon: <EmojiEventsIcon fontSize="small" /> },
                      { label: 'Commitments', to: '/commitments', icon: <VerifiedIcon fontSize="small" /> },
                      { label: 'Services', to: '/services', icon: <HandshakeIcon fontSize="small" /> },
                      { label: 'Marketplace', to: '/marketplace', icon: <StorefrontIcon fontSize="small" /> },
                      { label: 'Leaderboard', to: '/leaderboard', icon: <LeaderboardIcon fontSize="small" /> },
                      { label: 'Analytics', to: '/analytics', icon: <BarChartIcon fontSize="small" /> },
                    ].map(({ label, to, icon }) => (
                      <MenuItem key={label} onClick={() => { setMoreMenuAnchor(null); handleNav(to); }} sx={{ gap: 1.5, py: 1.25 }}>
                        <Box sx={{ color: 'text.secondary' }}>{icon}</Box>
                        <Typography variant="body2">{label}</Typography>
                      </MenuItem>
                    ))}
                  </Menu>
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

                  {/* Points chip */}
                  {(user.praxis_points ?? 0) > 0 && (
                    <Chip
                      icon={<ElectricBoltIcon sx={{ color: '#A78BFA !important', fontSize: '14px !important' }} />}
                      label={`${(user.praxis_points ?? 0).toLocaleString()} PP`}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(167,139,250,0.1)',
                        border: '1px solid rgba(167,139,250,0.25)',
                        color: '#A78BFA',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => {}}
                    />
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

                  {/* Notification bell */}
                  <Tooltip title="Notifications">
                    <IconButton
                      onClick={handleOpenNotifs}
                      sx={{ color: unreadCount > 0 ? 'primary.main' : 'text.secondary', p: 0.75 }}
                      aria-label="notifications"
                    >
                      <Badge badgeContent={unreadCount || undefined} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}>
                        {unreadCount > 0 ? <NotificationsIcon fontSize="small" /> : <NotificationsNoneIcon fontSize="small" />}
                      </Badge>
                    </IconButton>
                  </Tooltip>

                  {/* Notifications Popover */}
                  <Popover
                    open={Boolean(notifAnchor)}
                    anchorEl={notifAnchor}
                    onClose={() => setNotifAnchor(null)}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    slotProps={{
                      paper: {
                        sx: {
                          mt: 1, width: 340, maxHeight: 480,
                          bgcolor: '#1F2937',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          display: 'flex', flexDirection: 'column',
                        },
                      },
                    }}
                  >
                    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Notifications</Typography>
                      {notifications.some(n => !n.read) && (
                        <Tooltip title="Mark all read">
                          <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={async () => {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session?.access_token) return;
                            await fetch(`${API_URL}/notifications/read-all`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
                            setUnreadCount(0);
                            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                          }}>
                            <DoneAllIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    <Box sx={{ overflowY: 'auto', flex: 1 }}>
                      {notifications.length === 0 ? (
                        <Box sx={{ py: 5, textAlign: 'center' }}>
                          <NotificationsNoneIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                          <Typography variant="body2" color="text.disabled">No notifications yet</Typography>
                        </Box>
                      ) : (
                        notifications.map(n => (
                          <Box
                            key={n.id}
                            onClick={() => { if (n.link) navigate(n.link); setNotifAnchor(null); }}
                            sx={{
                              px: 2, py: 1.25,
                              cursor: n.link ? 'pointer' : 'default',
                              bgcolor: n.read ? 'transparent' : 'rgba(245,158,11,0.05)',
                              borderLeft: n.read ? '3px solid transparent' : '3px solid rgba(245,158,11,0.5)',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              display: 'flex', gap: 1.5, alignItems: 'flex-start',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                            }}
                          >
                            <Typography sx={{ fontSize: '1.1rem', flexShrink: 0, mt: 0.1 }}>{notifIcon(n.type)}</Typography>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: n.read ? 500 : 700, lineHeight: 1.3 }} noWrap>{n.title}</Typography>
                              {n.body && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }} noWrap>{n.body}</Typography>}
                              <Typography variant="caption" color="text.disabled">{timeAgo(n.created_at)}</Typography>
                            </Box>
                            <IconButton size="small" sx={{ color: 'text.disabled', flexShrink: 0, mt: -0.25 }} onClick={(e) => handleDeleteNotif(n.id, e)}>
                              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                        ))
                      )}
                    </Box>
                  </Popover>

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
                      {user.username && (
                        <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 600 }}>
                          @{user.username}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{user.email}</Typography>
                      {(user.praxis_points ?? 0) > 0 && (
                        <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>
                          ⚡ {(user.praxis_points ?? 0).toLocaleString()} PP
                        </Typography>
                      )}
                    </Box>

                    <MenuItem onClick={() => handleNav(`/profile/${user.id}`)} sx={{ gap: 1.5, py: 1.25 }}>
                      <AccountCircleIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">My Profile</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/analytics')} sx={{ gap: 1.5, py: 1.25 }}>
                      <BarChartIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Analytics</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/services')} sx={{ gap: 1.5, py: 1.25 }}>
                      <HandshakeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Services</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/marketplace')} sx={{ gap: 1.5, py: 1.25 }}>
                      <StorefrontIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Marketplace</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/commitments')} sx={{ gap: 1.5, py: 1.25 }}>
                      <VerifiedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Commitments</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => handleNav('/settings')} sx={{ gap: 1.5, py: 1.25 }}>
                      <SettingsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2">Settings</Typography>
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
                <Box sx={{ display: 'flex', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                  {(user.praxis_points ?? 0) > 0 && (
                    <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>
                      ⚡ {(user.praxis_points ?? 0).toLocaleString()} PP
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">{user.email}</Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            <List disablePadding>
              {[
                { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon />, primary: true },
                { label: 'Matches', to: '/matches', icon: <ExploreIcon />, primary: true },
                { label: 'Chat', to: '/communication', icon: <ChatIcon />, primary: true },
                { label: 'Challenges', to: '/challenges', icon: <EmojiEventsIcon />, primary: false },
                { label: 'Commitments', to: '/commitments', icon: <VerifiedIcon />, primary: false },
                { label: 'Services', to: '/services', icon: <HandshakeIcon />, primary: false },
                { label: 'Marketplace', to: '/marketplace', icon: <StorefrontIcon />, primary: false },
                { label: 'Analytics', to: '/analytics', icon: <BarChartIcon />, primary: false },
                { label: 'My Profile', to: `/profile/${user.id}`, icon: <AccountCircleIcon />, primary: false },
                { label: 'Settings', to: '/settings', icon: <SettingsIcon />, primary: false },
              ].map(({ label, to, icon, primary }, idx, arr) => (
                <React.Fragment key={label}>
                  {/* Divider between primary and secondary items */}
                  {!primary && idx > 0 && arr[idx - 1].primary && (
                    <Box sx={{ px: 2, py: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.62rem' }}>More</Typography>
                    </Box>
                  )}
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => handleNav(to)}>
                      <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>{icon}</ListItemIcon>
                      <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9375rem' }} />
                    </ListItemButton>
                  </ListItem>
                </React.Fragment>
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
