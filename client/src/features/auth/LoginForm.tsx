import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_URL } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { nuclearReset } from '../../utils/versionControl';
import ContributionGraph from '../../components/common/ContributionGraph';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Link as MuiLink,
  Alert,
  Divider,
  MenuItem,
  Menu,
  LinearProgress,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GoogleIcon from '@mui/icons-material/Google';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LanguageIcon from '@mui/icons-material/Language';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

const LoginForm: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [langAnchor, setLangAnchor] = useState<null | HTMLElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [weekStats, setWeekStats] = useState({ total: 0, streak: 0 });

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchWeekStats(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchWeekStats(session.user.id);
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchWeekStats = async (userId: string) => {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const { data: entries } = await supabase
        .from('notebook_entries')
        .select('occurred_at')
        .eq('user_id', userId)
        .gte('occurred_at', startOfWeek.toISOString());

      const total = entries?.length || 0;

      // Calculate streak (consecutive days with entries)
      let streak = 0;
      if (entries && entries.length > 0) {
        const uniqueDays = [...new Set(entries.map(e => e.occurred_at.slice(0, 10)))].sort().reverse();
        const today = new Date().toISOString().slice(0, 10);
        let expectedDate = new Date(today);

        for (const day of uniqueDays) {
          const dayDate = new Date(day + 'T00:00:00');
          const diffDays = Math.floor((expectedDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays <= 1) {
            streak++;
            expectedDate = dayDate;
            expectedDate.setDate(expectedDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      setWeekStats({ total, streak });
    } catch (error) {
      console.error('Failed to fetch week stats:', error);
    }
  };

  const handleLanguageOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLangAnchor(event.currentTarget);
  };

  const handleLanguageClose = () => {
    setLangAnchor(null);
  };

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    handleLanguageClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Sync language to backend if possible
      if (data.user) {
        axios.put(`${API_URL}/users/${data.user.id}`, { language: i18n.language })
          .catch(e => console.warn('Lang sync failed', e));
      }

      setIsError(false);
      setMessage('Login successful!');
      window.location.href = '/dashboard';
    } catch (error: any) {
      setIsError(true);
      setMessage(error.message || 'Login failed.');
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        data: {
          language: i18n.language
        }
      },
    });
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

        {/* Activity Graph - shown when logged in */}
        {currentUser && (
          <Box sx={{
            mt: 5, p: 3, borderRadius: '20px',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            width: '100%', maxWidth: 340,
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary', fontSize: '0.7rem', letterSpacing: '0.08em' }}>
              THIS WEEK'S ACTIVITY
            </Typography>

            {/* Stats row */}
            <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 2.5 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main', lineHeight: 1 }}>
                  {weekStats.total}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                  Entries
                </Typography>
              </Box>
              <Box sx={{ width: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#F97316', lineHeight: 1 }}>
                  {weekStats.streak}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                  Day Streak
                </Typography>
              </Box>
            </Stack>

            {/* Contribution graph - line chart */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <ContributionGraph userId={currentUser.id} height={60} width={200} />
            </Box>
          </Box>
        )}

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
        <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
          <Button
            size="small"
            startIcon={<LanguageIcon />}
            onClick={handleLanguageOpen}
            sx={{ borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.primary', px: 2 }}
          >
            {LANGUAGES.find(l => l.code === i18n.language)?.label || 'Language'}
          </Button>
          <Menu
            anchorEl={langAnchor}
            open={Boolean(langAnchor)}
            onClose={handleLanguageClose}
            PaperProps={{ sx: { bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', mt: 1 } }}
          >
            {LANGUAGES.map((lang) => (
              <MenuItem 
                key={lang.code} 
                onClick={() => handleLanguageChange(lang.code)}
                selected={i18n.language === lang.code}
                sx={{ gap: 1.5, fontSize: '0.9rem' }}
              >
                <span>{lang.flag}</span>
                {lang.label}
              </MenuItem>
            ))}
          </Menu>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>{t('login_title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            {t('login_subtitle')}
          </Typography>

          {message && <Alert severity={isError ? 'error' : 'success'} sx={{ mb: 3 }}>{message}</Alert>}

          <Box component="form" onSubmit={handleLogin} noValidate>
            <Stack spacing={2}>
              <TextField
                fullWidth required label={t('email')} type="email"
                autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                fullWidth required label={t('password')} type="password"
                autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </Stack>

            <Button
              type="submit" fullWidth variant="contained" color="primary"
              endIcon={<ArrowForwardIcon />}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              {t('sign_in')}
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
              {t('no_account')}{' '}
              <MuiLink component={RouterLink} to="/signup" sx={{ fontWeight: 600 }}>
                {t('sign_up')}
              </MuiLink>
            </Typography>

            <Box sx={{ mt: 6, p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1, textAlign: 'center' }}>
                {t('mobile_issues')}
              </Typography>
              <Button
                fullWidth size="small" variant="text" color="inherit"
                onClick={nuclearReset}
                startIcon={<RestartAltIcon sx={{ fontSize: '1rem' }} />}
                sx={{ fontSize: '0.65rem', opacity: 0.6, '&:hover': { opacity: 1 } }}
              >
                {t('force_refresh')}
              </Button>
            </Box>

            <Box sx={{ mt: 4, opacity: 0.3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                PRAXIS BUILD: 2026.03.12.V4-STABLE
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginForm;
