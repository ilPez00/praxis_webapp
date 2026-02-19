import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppRouter from './AppRouter'; // Import AppRouter
import ErrorBoundary from './components/ErrorBoundary'; // Import ErrorBoundary
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    primary: {
      main: '#212121', // Dark grey, close to black
    },
    secondary: {
      main: '#ffffff', // White
    },
    error: {
      main: '#F44336', // Standard error color
    },
    warning: {
      main: '#FF9800', // Standard warning color
    },
    info: {
      main: '#2196F3', // Standard info color
    },
    success: {
      main: '#4CAF50', // Standard success color
    },
    action: {
      active: '#FF5722', // Vibrant orange for active elements
      hover: '#FF5722', // Vibrant orange for hover elements
      selected: '#FF5722', // Vibrant orange for selected elements
      disabled: '#E0E0E0',
      disabledBackground: '#BDBDBD',
    },
    text: {
      primary: '#212121', // Dark text
      secondary: '#757575', // Medium grey text
    },
    background: {
      default: '#F5F5F5', // Light grey background
      paper: '#FFFFFF', // White paper background
    },
  },
  typography: {
    fontFamily: [
      'Roboto', // A common sans-serif font
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Keep button text as is
          borderRadius: 0, // Sharp edges
        },
        containedPrimary: {
          backgroundColor: '#FF5722', // Orange for primary contained buttons
          '&:hover': {
            backgroundColor: '#E64A19', // Darker orange on hover
          },
        },
        outlinedPrimary: {
          color: '#FF5722', // Orange text for outlined buttons
          borderColor: '#FF5722', // Orange border
          '&:hover': {
            borderColor: '#E64A19',
            color: '#E64A19',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0, // Sharp edges for text fields
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#212121', // Dark app bar
          color: '#FFFFFF', // White text
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: '#FF5722', // Orange links
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
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
        <AppRouter /> {/* Render AppRouter */}
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
