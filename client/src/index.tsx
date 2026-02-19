import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppRouter from './AppRouter';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// ─── Premium Dark Theme ────────────────────────────────────────────────────────
// Palette: deep dark backgrounds, amber-gold primary, electric violet secondary.
// Inspired by high-end fintech / productivity app aesthetics.
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#F59E0B',       // Amber-gold
      light: '#FCD34D',
      dark: '#D97706',
      contrastText: '#0A0B14',
    },
    secondary: {
      main: '#8B5CF6',       // Electric violet
      light: '#A78BFA',
      dark: '#6D28D9',
      contrastText: '#ffffff',
    },
    error: {
      main: '#EF4444',
    },
    warning: {
      main: '#F59E0B',
      contrastText: '#0A0B14',
    },
    success: {
      main: '#10B981',
    },
    info: {
      main: '#3B82F6',
    },
    background: {
      default: '#0A0B14',    // Deep dark
      paper: '#111827',      // Slightly lighter dark
    },
    text: {
      primary: '#F9FAFB',
      secondary: '#9CA3AF',
      disabled: '#4B5563',
    },
    divider: 'rgba(255,255,255,0.08)',
  },

  typography: {
    fontFamily: '"Inter", "Arial", sans-serif',
    h1: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 800 },
    h2: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 700 },
    h3: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 700 },
    h4: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 700 },
    h5: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif', fontWeight: 600 },
    button: { fontWeight: 600, letterSpacing: '0.01em' },
  },

  shape: {
    borderRadius: 16,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 10%, rgba(245,158,11,0.06) 0%, transparent 60%)',
          backgroundAttachment: 'fixed',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { width: '6px' },
          '&::-webkit-scrollbar-track': { background: '#0A0B14' },
          '&::-webkit-scrollbar-thumb': { background: '#374151', borderRadius: '3px' },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          fontWeight: 600,
          transition: 'all 0.2s ease',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
            boxShadow: '0 6px 28px rgba(245,158,11,0.45)',
            transform: 'translateY(-1px)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
          boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
          '&:hover': {
            boxShadow: '0 6px 28px rgba(139,92,246,0.45)',
            transform: 'translateY(-1px)',
          },
        },
        outlinedPrimary: {
          borderColor: '#F59E0B',
          color: '#F59E0B',
          '&:hover': {
            borderColor: '#FCD34D',
            color: '#FCD34D',
            backgroundColor: 'rgba(245,158,11,0.08)',
          },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.06)',
        },
        elevation3: {
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.06)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          },
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
            '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
          },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(10,11,20,0.8)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'none',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },

    MuiAvatar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #F59E0B 0%, #8B5CF6 100%)',
          color: '#ffffff',
          fontWeight: 700,
        },
      },
    },

    MuiLink: {
      styleOverrides: {
        root: {
          color: '#F59E0B',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline', color: '#FCD34D' },
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid',
        },
        standardInfo: {
          borderColor: 'rgba(59,130,246,0.3)',
          backgroundColor: 'rgba(59,130,246,0.1)',
        },
        standardWarning: {
          borderColor: 'rgba(245,158,11,0.3)',
          backgroundColor: 'rgba(245,158,11,0.1)',
        },
        standardError: {
          borderColor: 'rgba(239,68,68,0.3)',
          backgroundColor: 'rgba(239,68,68,0.1)',
        },
        standardSuccess: {
          borderColor: 'rgba(16,185,129,0.3)',
          backgroundColor: 'rgba(16,185,129,0.1)',
        },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255,255,255,0.06)',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1F2937',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
        },
      },
    },

    MuiSlider: {
      styleOverrides: {
        root: {
          color: '#F59E0B',
        },
        track: {
          background: 'linear-gradient(90deg, #F59E0B, #D97706)',
        },
        thumb: {
          boxShadow: '0 0 0 8px rgba(245,158,11,0.16)',
          '&:hover': {
            boxShadow: '0 0 0 12px rgba(245,158,11,0.24)',
          },
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },

    MuiCircularProgress: {
      styleOverrides: {
        colorPrimary: {
          color: '#F59E0B',
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
