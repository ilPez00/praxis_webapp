import React, { useState, useEffect } from 'react';
import {
  Snackbar,
  Button,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddBoxIcon from '@mui/icons-material/AddBox';

const InstallPwaBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setOpen(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setOpen(false);
  };

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={10000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ mb: { xs: 8, sm: 2 } }} // Account for mobile navbar
    >
      <GlassCard sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(139,92,246,0.1) 100%)',
        border: '1px solid rgba(245,158,11,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: '10px',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          flexShrink: 0,
        }}>
          <AddBoxIcon />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            Add Praxis to Home Screen
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Install for a better experience and quick access.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            onClick={handleInstallClick}
            sx={{ fontWeight: 700, borderRadius: '8px' }}
          >
            Install
          </Button>
          <IconButton size="small" onClick={handleClose} sx={{ color: 'text.disabled' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </GlassCard>
    </Snackbar>
  );
};

// Internal minimal GlassCard since we might not have it in common yet or want to customize it
const GlassCard: React.FC<{ children: React.ReactNode; sx?: any }> = ({ children, sx }) => (
  <Box sx={{
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    ...sx,
  }}>
    {children}
  </Box>
);

// Internal minimal Stack
const Stack: React.FC<{ children: React.ReactNode; direction?: string; spacing?: number; sx?: any }> = ({ children, direction = 'column', spacing = 0, sx }) => (
  <Box sx={{ display: 'flex', flexDirection: direction, gap: spacing, ...sx }}>
    {children}
  </Box>
);

export default InstallPwaBanner;
