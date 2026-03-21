import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Divider, Switch, FormControlLabel,
  Button, Stack, Chip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Select, MenuItem,
  FormControl, InputLabel,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LockIcon from '@mui/icons-material/Lock';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BarChartIcon from '@mui/icons-material/BarChart';

import LanguageIcon from '@mui/icons-material/Language';
import GlassCard from '../../components/common/GlassCard';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';

const NOTIF_PREFS_KEY = 'praxis_notif_prefs';
const ANALYTICS_OPT_KEY = 'praxis_analytics_opt';
const LANGUAGE_KEY = 'praxis_language';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

function loadNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}'); } catch { return {}; }
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <GlassCard sx={{ p: 3, mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      {icon}
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
    </Box>
    <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
    {children}
  </GlassCard>
);

const SettingsPage: React.FC = () => {
  const { user, refetch } = useUser();
  const navigate = useNavigate();

  // Notification prefs (localStorage)
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    messages: true, matches: true, verifications: true, bets: true,
    streaks: true, friends: true, referrals: true,
    ...loadNotifPrefs(),
  });

  // Geolocation
  const [geoCity, setGeoCity] = useState<string>('');
  const [geoLoading, setGeoLoading] = useState(false);

  // Privacy
  const [matchVisibility, setMatchVisibility] = useState<string>('all');
  const [profilePublic, setProfilePublic] = useState(true);
  const [shareNotesPublicly, setShareNotesPublicly] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);

  // Analytics
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() =>
    localStorage.getItem(ANALYTICS_OPT_KEY) !== 'off'
  );

  // Language
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_KEY) || 'en');

  // Danger zone
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Load user's city and privacy settings from profile
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('city, is_public, match_visibility, share_notes_publicly')
        .eq('id', user.id)
        .single();
      if (data) {
        setGeoCity(data.city || '');
        setProfilePublic(data.is_public !== false);
        setMatchVisibility(data.match_visibility || 'all');
        setShareNotesPublicly(data.share_notes_publicly || false);
      }
    };
    loadProfile();
  }, [user]);

  const saveNotifPref = (key: string, val: boolean) => {
    const updated = { ...notifPrefs, [key]: val };
    setNotifPrefs(updated);
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported.'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const geo = await resp.json();
          const city = geo.address?.city || geo.address?.town || geo.address?.village || '';
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token && user) {
            await axios.put(`${API_URL}/users/${user.id}`, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              city,
            }, { headers: { Authorization: `Bearer ${session.access_token}` } });
            setGeoCity(city);
            toast.success(`Location set to ${city || 'your position'}`);
          }
        } catch { toast.error('Could not detect city name.'); }
        finally { setGeoLoading(false); }
      },
      () => { toast.error('Location access denied.'); setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const clearLocation = async () => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await axios.put(`${API_URL}/users/${user.id}`,
      { latitude: null, longitude: null, city: null },
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    setGeoCity('');
    toast.success('Location data cleared.');
  };

  const savePrivacy = async () => {
    if (!user) return;
    setPrivacySaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.put(`${API_URL}/users/${user.id}`,
        { 
          is_public: profilePublic, 
          match_visibility: matchVisibility,
          share_notes_publicly: shareNotesPublicly,
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      toast.success('Privacy settings saved.');
    } catch { toast.error('Failed to save settings.'); }
    finally { setPrivacySaving(false); }
  };

  const handleResetGoals = async () => {
    if (confirmText !== 'RESET') return;
    setDangerLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/users/me/reset-goals`, {}, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast.success('Notebook reset. Starting fresh!');
      setResetDialogOpen(false);
      setConfirmText('');
      navigate('/goals');
    } catch { toast.error('Failed to reset goals.'); }
    finally { setDangerLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return;
    setDangerLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.delete(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      await supabase.auth.signOut();
      toast.success('Account deleted. Goodbye!');
      navigate('/');
    } catch { toast.error('Failed to delete account.'); }
    finally { setDangerLoading(false); }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <SettingsIcon sx={{ color: 'primary.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Settings</Typography>
          <Typography variant="body2" color="text.secondary">Manage your account preferences</Typography>
        </Box>
      </Box>

      {/* Notifications */}
      <Section icon={<NotificationsIcon sx={{ color: '#60A5FA' }} />} title="Notifications">
        <Stack spacing={0.5}>
          {[
            { key: 'messages', label: 'New messages' },
            { key: 'matches', label: 'New matches' },
            { key: 'verifications', label: 'Goal verifications' },
            { key: 'bets', label: 'Bet results' },
            { key: 'streaks', label: 'Streak reminders' },
            { key: 'friends', label: 'Friend requests' },
            { key: 'referrals', label: 'Referral rewards' },
          ].map(({ key, label }) => (
            <FormControlLabel
              key={key}
              control={
                <Switch
                  checked={notifPrefs[key] !== false}
                  onChange={e => saveNotifPref(key, e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="body2">{label}</Typography>}
              sx={{ justifyContent: 'space-between', ml: 0, mr: 0 }}
              labelPlacement="start"
            />
          ))}
        </Stack>
        <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem', borderRadius: '10px' }}>
          Push notification delivery depends on your device and browser settings.
        </Alert>
      </Section>

      {/* Geolocation */}
      <Section icon={<MyLocationIcon sx={{ color: '#34D399' }} />} title="Geolocation">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Your location is used to show nearby users and local events. It is never shared without your consent.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {geoCity ? (
            <Chip label={`📍 ${geoCity}`} sx={{ bgcolor: 'rgba(52,211,153,0.1)', color: '#34D399', fontWeight: 700 }} />
          ) : (
            <Chip label="No location set" variant="outlined" sx={{ color: 'text.disabled' }} />
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={geoLoading ? <CircularProgress size={14} color="inherit" /> : <MyLocationIcon />}
            onClick={detectLocation}
            disabled={geoLoading}
            sx={{ borderRadius: '8px' }}
          >
            {geoLoading ? 'Detecting…' : 'Detect location'}
          </Button>
          {geoCity && (
            <Button size="small" color="error" onClick={clearLocation} sx={{ borderRadius: '8px' }}>
              Clear location
            </Button>
          )}
        </Box>
      </Section>

      {/* Privacy */}
      <Section icon={<LockIcon sx={{ color: '#A78BFA' }} />} title="Profile & Notes Privacy">
        <Stack spacing={2}>
          <FormControlLabel
            control={<Switch checked={profilePublic} onChange={e => setProfilePublic(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>Public profile</Typography>
                <Typography variant="caption" color="text.secondary">
                  Others can view your profile, goals, and stats
                </Typography>
              </Box>
            }
            sx={{ justifyContent: 'space-between', ml: 0, mr: 0 }}
            labelPlacement="start"
          />
          <FormControlLabel
            control={<Switch checked={shareNotesPublicly} onChange={e => setShareNotesPublicly(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>📔 Share my notes publicly</Typography>
                <Typography variant="caption" color="text.secondary">
                  Others can see BROAD DETAILS of your diary/notebook entries (goal names only, no content)
                </Typography>
              </Box>
            }
            sx={{ justifyContent: 'space-between', ml: 0, mr: 0 }}
            labelPlacement="start"
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Show me in matches</InputLabel>
            <Select
              value={matchVisibility}
              label="Show me in matches"
              onChange={e => setMatchVisibility(e.target.value)}
            >
              <MenuItem value="all">Everyone</MenuItem>
              <MenuItem value="friends">Friends of friends only</MenuItem>
              <MenuItem value="none">Nobody (hide from matches)</MenuItem>
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ fontSize: '0.75rem', borderRadius: '10px' }}>
            <Typography variant="caption">
              <strong>Note:</strong> Even when public, others ONLY see goal names you've selected — never your private content, mood, or details.
            </Typography>
          </Alert>
          <Button
            variant="contained"
            onClick={savePrivacy}
            disabled={privacySaving}
            sx={{ borderRadius: '10px', alignSelf: 'flex-start' }}
          >
            {privacySaving ? <CircularProgress size={16} color="inherit" /> : 'Save privacy settings'}
          </Button>
        </Stack>
      </Section>

      {/* Analytics */}
      <Section icon={<BarChartIcon sx={{ color: '#F59E0B' }} />} title="Analytics">
        <FormControlLabel
          control={
            <Switch
              checked={analyticsEnabled}
              onChange={e => {
                setAnalyticsEnabled(e.target.checked);
                localStorage.setItem(ANALYTICS_OPT_KEY, e.target.checked ? 'on' : 'off');
                toast.success(e.target.checked ? 'Analytics enabled.' : 'Analytics opted out.');
              }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>Usage analytics</Typography>
              <Typography variant="caption" color="text.secondary">
                Help us improve Praxis by sharing anonymous usage data
              </Typography>
            </Box>
          }
          sx={{ justifyContent: 'space-between', ml: 0, mr: 0 }}
          labelPlacement="start"
        />
      </Section>

      {/* Language */}
      <Section icon={<LanguageIcon sx={{ color: '#34D399' }} />} title="Language">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Interface Language</InputLabel>
            <Select
              value={language}
              label="Interface Language"
              onChange={(e) => {
                const lang = e.target.value;
                setLanguage(lang);
                localStorage.setItem(LANGUAGE_KEY, lang);
                document.documentElement.lang = lang;
                toast.success(`Language set to ${SUPPORTED_LANGUAGES.find(l => l.code === lang)?.label ?? lang}`);
              }}
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            UI language preference — stored locally. Full i18n coming soon.
          </Typography>
        </Box>
      </Section>

      {/* Danger Zone */}
      <GlassCard sx={{ p: 3, border: '1px solid rgba(239,68,68,0.2)', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <DeleteForeverIcon sx={{ color: 'error.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'error.main' }}>Danger Zone</Typography>
        </Box>
        <Divider sx={{ mb: 2, borderColor: 'rgba(239,68,68,0.1)' }} />
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={700}>Reset notebook</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Permanently delete your notebook and start fresh. Points are kept.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RestartAltIcon />}
              onClick={() => { setConfirmText(''); setResetDialogOpen(true); }}
              sx={{ borderRadius: '10px' }}
            >
              Reset goals
            </Button>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight={700} color="error.main">Delete account</Typography>
              <Typography variant="caption" color="text.secondary">
                Permanently delete your account and all data. This cannot be undone.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => { setConfirmText(''); setDeleteDialogOpen(true); }}
              sx={{ borderRadius: '10px' }}
            >
              Delete account
            </Button>
          </Box>
        </Stack>
      </GlassCard>

      {/* Reset Goals Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'warning.main' }}>Reset notebook?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will permanently delete your entire notebook. Type <strong>RESET</strong> to confirm.
          </Typography>
          <TextField
            fullWidth size="small"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type RESET"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained" color="warning"
            disabled={confirmText !== 'RESET' || dangerLoading}
            onClick={handleResetGoals}
          >
            {dangerLoading ? <CircularProgress size={16} color="inherit" /> : 'Reset goals'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Delete account permanently?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            All your data will be erased. This cannot be undone. Type <strong>DELETE</strong> to confirm.
          </Typography>
          <TextField
            fullWidth size="small"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained" color="error"
            disabled={confirmText !== 'DELETE' || dangerLoading}
            onClick={handleDeleteAccount}
          >
            {dangerLoading ? <CircularProgress size={16} color="inherit" /> : 'Delete forever'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SettingsPage;
