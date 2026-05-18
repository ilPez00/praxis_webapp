import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Divider, Switch, FormControlLabel,
  Button, Stack, Chip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Select, MenuItem,
  FormControl, InputLabel, Tabs, Tab,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LockIcon from '@mui/icons-material/Lock';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BarChartIcon from '@mui/icons-material/BarChart';
import GavelIcon from '@mui/icons-material/Gavel';
import DownloadIcon from '@mui/icons-material/Download';
import LanguageIcon from '@mui/icons-material/Language';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import PersonIcon from '@mui/icons-material/Person';
import PsychologyIcon from '@mui/icons-material/Psychology';
import GlassCard from '../../components/common/GlassCard';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';
import { usePushNotifications } from '../../hooks/usePushNotifications';

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

type Agent = { id: string; slug: string; name: string; website: string | null; icon_url: string | null; description: string | null };
type AgentKey = { id: string; api_key: string; scope: string[]; created_at: string; last_used_at: string | null; expires_at: string; agent: Agent };
type PersonalAgentEntry = { id: string; name: string; last_used_at: string | null; created_at: string };

function loadNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}'); } catch { return {}; }
}

// ─── Shared Section wrapper ────────────────────────────────────────────────
const Section: React.FC<{ icon?: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <GlassCard sx={{ p: 3, mb: 2 }}>
    {(icon || title) && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
      </Box>
    )}
    <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
    {children}
  </GlassCard>
);

// ─── Row helper ────────────────────────────────────────────────────────────
const SettingRow: React.FC<{ label: string; sub?: string; children: React.ReactNode }> = ({ label, sub, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, py: 0.5 }}>
    <Box>
      <Typography variant="body2" fontWeight={600}>{label}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Box>
    {children}
  </Box>
);

// ─── Agents Panel (Integrations tab) ──────────────────────────────────────
function AgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [personalAgents, setPersonalAgents] = useState<PersonalAgentEntry[]>([]);
  const [newAgentName, setNewAgentName] = useState('');
  const [creatingPat, setCreatingPat] = useState(false);

  useEffect(() => { loadAgents(); loadKeys(); loadPersonalAgents(); }, []);

  const loadAgents = async () => {
    try { const res = await api.get('/agent/agents'); setAgents(res.data.agents || []); } catch { setAgents([]); }
    setLoading(false);
  };
  const loadKeys = async () => {
    try { const res = await api.get('/agent/keys'); setKeys(res.data.keys || []); } catch { setKeys([]); }
  };
  const loadPersonalAgents = async () => {
    try { const res = await api.get('/agent/activity'); setPersonalAgents(res.data.agents || []); } catch { setPersonalAgents([]); }
  };

  const handleCreatePersonalPat = async () => {
    if (!newAgentName.trim()) return;
    setCreatingPat(true);
    try {
      const res = await api.post('/agent/keys/personal', { name: newAgentName.trim() });
      const key: string = res.data?.api_key || '';
      if (key) {
        await navigator.clipboard.writeText(key);
        toast.success(`PAT for "${newAgentName.trim()}" copied — shown once, store it.`);
        setNewAgentName('');
        loadPersonalAgents();
      }
    } catch { toast.error('Failed to create PAT'); }
    setCreatingPat(false);
  };

  const handleGenerateKey = async (agentId: string, agentName: string, slug: string) => {
    if (!confirm(`Generate API key for ${agentName}?`)) return;
    setConnecting(slug);
    try {
      const res = await api.post('/agent/keys/direct', { agent_id: agentId });
      if (res.data?.api_key) {
        await navigator.clipboard.writeText(res.data.api_key);
        toast.success('API key copied!');
      }
    } catch { toast.error('Failed to generate key'); }
    setConnecting(null);
    loadKeys();
  };

  const handleRevoke = async (keyId: string, agentName: string) => {
    if (!confirm(`Revoke access for ${agentName}?`)) return;
    try {
      await api.delete('/agent/keys/' + keyId);
      setKeys(keys => keys.filter(k => k.id !== keyId));
      toast.success(`${agentName} disconnected`);
    } catch { toast.error('Failed to revoke access'); }
  };

  const handleCopyKey = async (keyId: string) => {
    try {
      const res = await api.get('/agent/keys/' + keyId);
      const fullKey = res.data?.api_key;
      if (fullKey) { await navigator.clipboard.writeText(fullKey); toast.success('Key copied!'); }
    } catch { toast.error('Failed to copy key'); }
  };

  const connectedSlugs = keys.map(k => k.agent?.slug);

  if (loading) return <CircularProgress size={20} />;

  return (
    <Stack spacing={3}>
      {/* Personal PATs */}
      <Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
          Personal Agent Tokens
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Any agent (Aura, scripts, Moltbook bots) authenticates with a PAT and posts check-ins, tracker logs, and goal progress on your behalf.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <TextField
            size="small" placeholder="Agent name (e.g. Aura, research-bot)"
            value={newAgentName} onChange={e => setNewAgentName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreatePersonalPat(); }}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
          <Button variant="contained" size="small"
            disabled={creatingPat || !newAgentName.trim()} onClick={handleCreatePersonalPat}
            sx={{ borderRadius: '8px', minWidth: 100 }}>
            {creatingPat ? <CircularProgress size={14} color="inherit" /> : 'Create PAT'}
          </Button>
        </Box>
        {personalAgents.length > 0 && (
          <Stack spacing={1}>
            {personalAgents.map(a => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'rgba(0,255,136,0.06)', borderRadius: '10px' }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{a.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.last_used_at ? 'Last active: ' + new Date(a.last_used_at).toLocaleDateString() : 'Never used'}
                  </Typography>
                </Box>
                <Chip label="ACTIVE" size="small" sx={{ color: 'rgba(0,255,136,0.8)', bgcolor: 'rgba(0,255,136,0.1)', fontWeight: 700, fontSize: '0.65rem' }} />
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Connected system agents */}
      {keys.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
            Connected System Agents
          </Typography>
          <Stack spacing={1}>
            {keys.map(key => (
              <Box key={key.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'rgba(139,92,246,0.1)', borderRadius: '10px' }}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{key.agent?.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {key.last_used_at ? 'Last used: ' + new Date(key.last_used_at).toLocaleDateString() : 'Never used'} · {key.api_key}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => handleCopyKey(key.id)}>Copy</Button>
                  <Button size="small" color="error" onClick={() => handleRevoke(key.id, key.agent?.name)}>Revoke</Button>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Available system agents */}
      <Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
          Available System Agents
        </Typography>
        <Stack spacing={1}>
          {agents.map(agent => {
            const isConnected = connectedSlugs.includes(agent.slug);
            const isLocal = ['openclaw', 'hermes', 'opencode', 'claude', 'qwen', 'gemini', 'lindy', 'relay', 'agentgpt'].includes(agent.slug);
            return (
              <Box key={agent.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={700}>{agent.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{agent.description}</Typography>
                </Box>
                {isConnected ? (
                  <Button size="small" variant="outlined" disabled sx={{ ml: 2, minWidth: 100, borderRadius: '8px' }}>Connected</Button>
                ) : isLocal ? (
                  <Button size="small" variant="contained"
                    disabled={connecting === agent.slug}
                    onClick={() => handleGenerateKey(agent.id, agent.name, agent.slug)}
                    sx={{ ml: 2, minWidth: 100, borderRadius: '8px' }}>
                    {connecting === agent.slug ? <CircularProgress size={14} color="inherit" /> : 'Generate Key'}
                  </Button>
                ) : (
                  <Button size="small" variant="outlined" disabled sx={{ ml: 2, minWidth: 100, borderRadius: '8px', opacity: 0.5 }}>Coming Soon</Button>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
}

// ─── Tab panels ────────────────────────────────────────────────────────────
interface TabPanelProps { value: number; index: number; children: React.ReactNode }
const TabPanel: React.FC<TabPanelProps> = ({ value, index, children }) => (
  <Box hidden={value !== index} sx={{ pt: 3 }}>{value === index && children}</Box>
);

// ══════════════════════════════════════════════════════════════════════════
const SettingsPage: React.FC = () => {
  const { user, refetch } = useUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  // Push notifications
  const { permission, subscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications(user?.id);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    messages: true, matches: true, verifications: true, bets: true,
    streaks: true, friends: true, referrals: true, ...loadNotifPrefs(),
  });
  const [reminderTime, setReminderTime] = useState('08:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);

  // Location
  const [geoCity, setGeoCity] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);

  // Language
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_KEY) || 'en');

  // Privacy
  const [matchVisibility, setMatchVisibility] = useState('all');
  const [profilePublic, setProfilePublic] = useState(true);
  const [shareNotesPublicly, setShareNotesPublicly] = useState(false);
  const [shareReflections, setShareReflections] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);

  // Analytics
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => localStorage.getItem(ANALYTICS_OPT_KEY) !== 'off');

  // Google Calendar
  const [syncLoading, setSyncLoading] = useState(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);

  // Danger zone
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, externalRes] = await Promise.all([
        supabase.from('profiles')
          .select('city, is_public, match_visibility, share_notes_publicly, location_enabled, share_reflections, checkin_reminder_time, checkin_reminder_enabled')
          .eq('id', user.id).single(),
        supabase.from('external_accounts').select('provider').eq('user_id', user.id).eq('provider', 'google').maybeSingle(),
      ]);
      if (profileRes.data) {
        setGeoCity(profileRes.data.city || '');
        setProfilePublic(profileRes.data.is_public !== false);
        setMatchVisibility(profileRes.data.match_visibility || 'all');
        setShareNotesPublicly(profileRes.data.share_notes_publicly || false);
        setShareReflections(profileRes.data.share_reflections || false);
        setLocationEnabled(profileRes.data.location_enabled || false);
        setReminderTime(profileRes.data.checkin_reminder_time || '08:00');
        setReminderEnabled(profileRes.data.checkin_reminder_enabled || false);
      }
      if (externalRes.data) setIsGoogleLinked(true);
    };
    load();
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
          const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const geo = await resp.json();
          const city = geo.address?.city || geo.address?.town || geo.address?.village || '';
          if (user) {
            await api.put(`/users/${user.id}`, { latitude: pos.coords.latitude, longitude: pos.coords.longitude, city });
            setGeoCity(city);
            toast.success(`Location set to ${city || 'your position'}`);
          }
        } catch { toast.error('Could not detect city.'); }
        finally { setGeoLoading(false); }
      },
      () => { toast.error('Location access denied.'); setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const clearLocation = async () => {
    if (!user) return;
    await api.put(`/users/${user.id}`, { latitude: null, longitude: null, city: null });
    setGeoCity('');
    toast.success('Location cleared.');
  };

  const handleToggleLocation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    if (!user) return;
    setLocationSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ location_enabled: enabled }).eq('id', user.id);
      if (error) throw error;
      setLocationEnabled(enabled);
      toast.success(enabled ? 'Location tracking enabled.' : 'Location tracking disabled.');
    } catch {
      toast.error('Failed to update location setting.');
      setLocationEnabled(!enabled);
    } finally { setLocationSaving(false); }
  };

  const savePrivacy = async () => {
    if (!user) return;
    setPrivacySaving(true);
    try {
      await Promise.all([
        api.put(`/users/${user.id}`, { is_public: profilePublic, match_visibility: matchVisibility, share_notes_publicly: shareNotesPublicly }),
        supabase.from('profiles').update({ share_reflections: shareReflections }).eq('id', user.id),
      ]);
      toast.success('Privacy settings saved.');
    } catch { toast.error('Failed to save settings.'); }
    finally { setPrivacySaving(false); }
  };

  const saveReminderSettings = async () => {
    if (!user) return;
    try {
      await supabase.from('profiles').update({ checkin_reminder_time: reminderTime, checkin_reminder_enabled: reminderEnabled }).eq('id', user.id);
      toast.success('Reminder settings saved.');
    } catch { toast.error('Failed to save reminder settings.'); }
  };

  const handleGoogleSync = async () => {
    setSyncLoading(true);
    try {
      const { data } = await api.get('/calendar/google/auth');
      if (data.authUrl) window.location.href = data.authUrl;
    } catch { toast.error('Failed to initiate Google sync'); setSyncLoading(false); }
  };

  const handleResetGoals = async () => {
    if (confirmText !== 'RESET') return;
    setDangerLoading(true);
    try {
      await api.post('/users/me/reset-goals', {});
      toast.success('Notebook reset.');
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
      await api.delete('/users/me');
      await supabase.auth.signOut();
      toast.success('Account deleted.');
      navigate('/');
    } catch { toast.error('Failed to delete account.'); }
    finally { setDangerLoading(false); }
  };

  const TABS = [
    { label: 'Account',       icon: <PersonIcon sx={{ fontSize: 16 }} /> },
    { label: 'Notifications', icon: <NotificationsIcon sx={{ fontSize: 16 }} /> },
    { label: 'Privacy',       icon: <LockIcon sx={{ fontSize: 16 }} /> },
    { label: 'Integrations',  icon: <SmartToyIcon sx={{ fontSize: 16 }} /> },
    { label: 'Data',          icon: <GavelIcon sx={{ fontSize: 16 }} /> },
  ];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <SettingsIcon sx={{ color: 'primary.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>Settings</Typography>
          <Typography variant="body2" color="text.secondary">Manage your account preferences</Typography>
        </Box>
      </Box>

      {/* Tab bar */}
      <GlassCard sx={{ mb: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{
            '& .MuiTab-root': { minHeight: 48, fontSize: '0.8rem', fontWeight: 700, textTransform: 'none', gap: 0.5 },
            '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
          }}
        >
          {TABS.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />
          ))}
        </Tabs>
      </GlassCard>

      {/* ── Tab 0: Account ──────────────────────────────────────────── */}
      <TabPanel value={tab} index={0}>
        <Section icon={<PersonIcon sx={{ color: '#60A5FA' }} />} title="Profile">
          <Stack spacing={2}>
            <SettingRow label="Edit profile" sub="Name, bio, occupation, avatar">
              <Button variant="outlined" size="small" sx={{ borderRadius: '8px' }} onClick={() => navigate('/profile')}>
                Go to Profile →
              </Button>
            </SettingRow>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <SettingRow label="Interface Language" sub="Stored locally — full i18n coming soon">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select value={language} onChange={e => {
                  const lang = e.target.value;
                  setLanguage(lang);
                  localStorage.setItem(LANGUAGE_KEY, lang);
                  document.documentElement.lang = lang;
                  toast.success(`Language: ${SUPPORTED_LANGUAGES.find(l => l.code === lang)?.label ?? lang}`);
                }}>
                  {SUPPORTED_LANGUAGES.map(l => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
                </Select>
              </FormControl>
            </SettingRow>
          </Stack>
        </Section>

        <Section icon={<MyLocationIcon sx={{ color: '#34D399' }} />} title="Location">
          <Stack spacing={2}>
            <FormControlLabel
              control={<Switch checked={locationEnabled} onChange={handleToggleLocation} disabled={locationSaving} />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Tag notes with location</Typography>
                  <Typography variant="caption" color="text.secondary">Notes and progress logs include your current position</Typography>
                </Box>
              }
              sx={{ justifyContent: 'space-between', ml: 0 }} labelPlacement="start"
            />
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <SettingRow label="City for matching" sub="Used to surface nearby users — never shared without consent">
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {geoCity
                  ? <Chip label={`📍 ${geoCity}`} sx={{ bgcolor: 'rgba(52,211,153,0.1)', color: '#34D399', fontWeight: 700 }} />
                  : <Chip label="Not set" variant="outlined" sx={{ color: 'text.disabled' }} />
                }
                <Button size="small" variant="outlined" startIcon={geoLoading ? <CircularProgress size={12} color="inherit" /> : <MyLocationIcon />}
                  onClick={detectLocation} disabled={geoLoading} sx={{ borderRadius: '8px' }}>
                  {geoLoading ? 'Detecting…' : 'Detect'}
                </Button>
                {geoCity && <Button size="small" color="error" onClick={clearLocation} sx={{ borderRadius: '8px' }}>Clear</Button>}
              </Box>
            </SettingRow>
          </Stack>
        </Section>
      </TabPanel>

      {/* ── Tab 1: Notifications ─────────────────────────────────────── */}
      <TabPanel value={tab} index={1}>
        <Section icon={<NotificationsIcon sx={{ color: '#60A5FA' }} />} title="Push Notifications">
          {'PushManager' in window && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(96,165,250,0.06)', borderRadius: '12px', border: '1px solid rgba(96,165,250,0.15)' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={subscribed} disabled={pushLoading || permission === 'denied'}
                    onChange={async () => {
                      if (subscribed) { await pushUnsubscribe(); toast.success('Push disabled'); }
                      else {
                        const ok = await pushSubscribe();
                        if (ok) toast.success('Push enabled!');
                        else if (permission === 'denied') toast('Notifications blocked by browser', { icon: '🚫' });
                      }
                    }}
                    size="small"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Browser Push</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {permission === 'denied' ? 'Blocked — enable in browser site settings' : subscribed ? 'Active — notified even when app is closed' : 'Get notified about messages, matches, and more'}
                    </Typography>
                  </Box>
                }
                sx={{ justifyContent: 'space-between', ml: 0 }} labelPlacement="start"
              />
            </Box>
          )}
          {!('PushManager' in window) && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px', fontSize: '0.75rem' }}>
              Push notifications not supported in this browser.
            </Alert>
          )}
        </Section>

        <Section icon={<NotificationsIcon sx={{ color: '#A78BFA' }} />} title="In-App Categories">
          <Stack spacing={0.5}>
            {[
              { key: 'messages',      label: 'New messages',      sub: 'Direct and group messages' },
              { key: 'matches',       label: 'New matches',       sub: 'Sparring partner suggestions' },
              { key: 'verifications', label: 'Goal verifications',sub: 'Peer verification requests' },
              { key: 'bets',          label: 'Bet results',       sub: 'Outcome notifications for bets' },
              { key: 'streaks',       label: 'Streak reminders',  sub: 'Daily streak maintenance alerts' },
              { key: 'friends',       label: 'Friend requests',   sub: 'New connection requests' },
              { key: 'referrals',     label: 'Referral rewards',  sub: 'PP earned from referrals' },
            ].map(({ key, label, sub }) => (
              <React.Fragment key={key}>
                <FormControlLabel
                  control={<Switch checked={notifPrefs[key] !== false} onChange={e => saveNotifPref(key, e.target.checked)} size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{label}</Typography>
                      <Typography variant="caption" color="text.secondary">{sub}</Typography>
                    </Box>
                  }
                  sx={{ justifyContent: 'space-between', ml: 0, py: 0.5 }} labelPlacement="start"
                />
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
              </React.Fragment>
            ))}
          </Stack>
        </Section>

        <Section icon={<NotificationsIcon sx={{ color: '#F59E0B' }} />} title="Daily Check-in Reminder">
          <Stack spacing={2}>
            <FormControlLabel
              control={<Switch checked={reminderEnabled} onChange={e => setReminderEnabled(e.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Daily reminder</Typography>
                  <Typography variant="caption" color="text.secondary">Push notification to check in at a fixed time</Typography>
                </Box>
              }
              sx={{ justifyContent: 'space-between', ml: 0 }} labelPlacement="start"
            />
            {reminderEnabled && (
              <SettingRow label="Reminder time" sub="Local time">
                <TextField type="time" size="small" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                  sx={{ width: 130, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }} />
              </SettingRow>
            )}
            <Button variant="contained" size="small" onClick={saveReminderSettings} sx={{ alignSelf: 'flex-start', borderRadius: '8px' }}>
              Save reminder
            </Button>
          </Stack>
        </Section>
      </TabPanel>

      {/* ── Tab 2: Privacy ──────────────────────────────────────────── */}
      <TabPanel value={tab} index={2}>
        <Section icon={<LockIcon sx={{ color: '#A78BFA' }} />} title="Profile Visibility">
          <Stack spacing={1.5}>
            <FormControlLabel
              control={<Switch checked={profilePublic} onChange={e => setProfilePublic(e.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Public profile</Typography>
                  <Typography variant="caption" color="text.secondary">Others can view your profile, goals, and stats</Typography>
                </Box>
              }
              sx={{ justifyContent: 'space-between', ml: 0 }} labelPlacement="start"
            />
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <FormControlLabel
              control={<Switch checked={shareNotesPublicly} onChange={e => setShareNotesPublicly(e.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Share notes publicly</Typography>
                  <Typography variant="caption" color="text.secondary">Broad goal names only — no note content or mood exposed</Typography>
                </Box>
              }
              sx={{ justifyContent: 'space-between', ml: 0 }} labelPlacement="start"
            />
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <SettingRow label="Show me in matches" sub="Who can find you via sparring partner search">
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select value={matchVisibility} onChange={e => setMatchVisibility(e.target.value)}>
                  <MenuItem value="all">Everyone</MenuItem>
                  <MenuItem value="friends">Friends of friends only</MenuItem>
                  <MenuItem value="none">Hidden from matches</MenuItem>
                </Select>
              </FormControl>
            </SettingRow>
          </Stack>
        </Section>

        <Section icon={<PsychologyIcon sx={{ color: '#F59E0B' }} />} title="AI & Data Sharing">
          <Stack spacing={1.5}>
            <FormControlLabel
              control={<Switch checked={analyticsEnabled} onChange={e => {
                setAnalyticsEnabled(e.target.checked);
                localStorage.setItem(ANALYTICS_OPT_KEY, e.target.checked ? 'on' : 'off');
                toast.success(e.target.checked ? 'Analytics enabled.' : 'Analytics opted out.');
              }} />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Usage analytics</Typography>
                  <Typography variant="caption" color="text.secondary">Anonymous usage data to improve Praxis</Typography>
                </Box>
              }
              sx={{ justifyContent: 'space-between', ml: 0 }} labelPlacement="start"
            />
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <FormControlLabel
              control={<Switch checked={shareReflections} onChange={e => setShareReflections(e.target.checked)} />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={600}>Contribute to reflection training</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Allow anonymised reflection data (goal + outcome, no personal content) to improve Axiom's causal reasoning
                  </Typography>
                </Box>
              }
              sx={{ justifyContent: 'space-between', ml: 0 }} labelPlacement="start"
            />
          </Stack>
          <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem', borderRadius: '10px' }}>
            Even when public, others only see goal names you select — never private content, mood, or diary entries.
          </Alert>
          <Button variant="contained" onClick={savePrivacy} disabled={privacySaving} sx={{ mt: 2, borderRadius: '10px', alignSelf: 'flex-start' }}>
            {privacySaving ? <CircularProgress size={16} color="inherit" /> : 'Save privacy settings'}
          </Button>
        </Section>
      </TabPanel>

      {/* ── Tab 3: Integrations ──────────────────────────────────────── */}
      <TabPanel value={tab} index={3}>
        {/* Google Calendar */}
        <Section icon={<CalendarTodayIcon sx={{ color: '#F87171' }} />} title="Google Calendar">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Link Google Calendar so Axiom can read your events and create new ones from your goals and deadlines.
          </Typography>
          {isGoogleLinked ? (
            <>
              <Alert severity="success" sx={{ mb: 2, bgcolor: 'rgba(52,211,153,0.1)', color: '#34D399', border: 'none' }}>
                Google Calendar linked — Axiom can read and create events.
              </Alert>
              <Button variant="outlined" color="error" fullWidth onClick={async () => {
                try { await api.delete('/calendar/google/disconnect'); setIsGoogleLinked(false); toast.success('Disconnected'); }
                catch { toast.error('Failed to disconnect'); }
              }} sx={{ borderRadius: '10px', py: 1 }}>
                Disconnect Google Calendar
              </Button>
            </>
          ) : (
            <Button variant="contained" fullWidth onClick={handleGoogleSync} disabled={syncLoading}
              startIcon={syncLoading ? <CircularProgress size={20} color="inherit" /> : <CalendarTodayIcon />}
              sx={{ bgcolor: '#DB4437', '&:hover': { bgcolor: '#C53929' }, borderRadius: '10px', py: 1.5, fontWeight: 700 }}>
              {syncLoading ? 'Connecting...' : 'Link Google Calendar'}
            </Button>
          )}
        </Section>

        {/* Aura */}
        <Section icon={<PhoneAndroidIcon sx={{ color: '#00FF88' }} />} title="Connect Aura">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Transfer your session to the Aura Android app. Open on your phone with Aura installed, or copy for ADB.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Button variant="outlined"
              startIcon={<PhoneAndroidIcon />}
              sx={{ borderRadius: '10px', borderColor: '#00FF88', color: '#00FF88', '&:hover': { bgcolor: 'rgba(0,255,136,0.08)' } }}
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                const s = data.session;
                if (!s) { toast.error('No active session'); return; }
                window.location.href = `aura://praxis/callback#access_token=${encodeURIComponent(s.access_token)}&refresh_token=${encodeURIComponent(s.refresh_token ?? '')}&expires_in=${s.expires_in ?? 3600}`;
              }}>
              Open in Aura
            </Button>
            <Button variant="outlined" startIcon={<ContentCopyIcon />} sx={{ borderRadius: '10px' }}
              onClick={async () => {
                const { data } = await supabase.auth.getSession();
                const s = data.session;
                if (!s) { toast.error('No active session'); return; }
                await navigator.clipboard.writeText(`aura://praxis/callback#access_token=${encodeURIComponent(s.access_token)}&refresh_token=${encodeURIComponent(s.refresh_token ?? '')}&expires_in=${s.expires_in ?? 3600}`);
                toast.success('Link copied — open on Android device');
              }}>
              Copy link
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Token valid ~1 hour. Re-generate if Aura shows "token expired".
          </Typography>
        </Section>

        {/* AI Agents */}
        <Section icon={<SmartToyIcon sx={{ color: '#8B5CF6' }} />} title="AI Agents">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Connect AI assistants to access your Praxis data, post check-ins, and update goals on your behalf.
          </Typography>
          <AgentsPanel />
        </Section>
      </TabPanel>

      {/* ── Tab 4: Data ─────────────────────────────────────────────── */}
      <TabPanel value={tab} index={4}>
        <Section icon={<DownloadIcon sx={{ color: '#34D399' }} />} title="Export">
          <Stack spacing={2}>
            <SettingRow label="Download my data" sub="All notebook entries, goals, and analytics as JSON">
              <Button variant="outlined" startIcon={<DownloadIcon />} sx={{ borderRadius: '10px' }}
                onClick={async () => {
                  toast.success('Preparing export...');
                  try {
                    const res = await api.post('/diary/export/notes', {}, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url; a.download = `praxis-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
                    window.URL.revokeObjectURL(url);
                    toast.success('Export downloaded!');
                  } catch { toast.error('Export failed.'); }
                }}>
                Export JSON
              </Button>
            </SettingRow>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <SettingRow label="Diary PDF" sub="Curated 365-day life log as PDF">
              <Button variant="outlined" startIcon={<DownloadIcon />} sx={{ borderRadius: '10px' }}
                onClick={async () => {
                  try {
                    const res = await api.get('/diary/export/plain', { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                    const a = document.createElement('a');
                    a.href = url; a.download = `praxis-diary-${new Date().toISOString().slice(0, 10)}.pdf`; a.click();
                    window.URL.revokeObjectURL(url);
                  } catch { toast.error('PDF export failed.'); }
                }}>
                Export PDF
              </Button>
            </SettingRow>
          </Stack>
        </Section>

        <Section icon={<GavelIcon sx={{ color: '#6366F1' }} />} title="Legal">
          <SettingRow label="Terms & Privacy" sub="Terms of Service, Privacy Policy, and data handling">
            <Button variant="outlined" startIcon={<GavelIcon />} sx={{ borderRadius: '10px' }}
              onClick={() => window.open('https://praxis.mypractice.ai/info', '_blank')}>
              View Policy
            </Button>
          </SettingRow>
        </Section>

        {/* Danger Zone */}
        <GlassCard sx={{ p: 3, border: '1px solid rgba(239,68,68,0.2)', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <DeleteForeverIcon sx={{ color: 'error.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'error.main' }}>Danger Zone</Typography>
          </Box>
          <Divider sx={{ mb: 2, borderColor: 'rgba(239,68,68,0.1)' }} />
          <Stack spacing={2}>
            <SettingRow label="Reset notebook" sub="Permanently delete your notebook and start fresh. Points kept.">
              <Button variant="outlined" color="warning" startIcon={<RestartAltIcon />}
                onClick={() => { setConfirmText(''); setResetDialogOpen(true); }} sx={{ borderRadius: '10px' }}>
                Reset goals
              </Button>
            </SettingRow>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <SettingRow label="Delete account" sub="Permanently erase your account and all data. Cannot be undone.">
              <Button variant="outlined" color="error" startIcon={<DeleteForeverIcon />}
                onClick={() => { setConfirmText(''); setDeleteDialogOpen(true); }} sx={{ borderRadius: '10px' }}>
                Delete account
              </Button>
            </SettingRow>
          </Stack>
        </GlassCard>
      </TabPanel>

      {/* Dialogs */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'warning.main' }}>Reset notebook?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>This permanently deletes your notebook. Type <strong>RESET</strong> to confirm.</Typography>
          <TextField fullWidth size="small" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type RESET" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" disabled={confirmText !== 'RESET' || dangerLoading} onClick={handleResetGoals}>
            {dangerLoading ? <CircularProgress size={16} color="inherit" /> : 'Reset goals'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Delete account permanently?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>All data erased. Cannot be undone. Type <strong>DELETE</strong> to confirm.</Typography>
          <TextField fullWidth size="small" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type DELETE" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={confirmText !== 'DELETE' || dangerLoading} onClick={handleDeleteAccount}>
            {dangerLoading ? <CircularProgress size={16} color="inherit" /> : 'Delete forever'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SettingsPage;
