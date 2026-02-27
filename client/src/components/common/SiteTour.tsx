import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GroupsIcon from '@mui/icons-material/Groups';
import ChatIcon from '@mui/icons-material/Chat';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import SchoolIcon from '@mui/icons-material/School';
import StorefrontIcon from '@mui/icons-material/Storefront';

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactElement;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Praxis!',
    description:
      'Your personal achievement platform — set goals, track progress, connect with partners, and grow every day.',
    icon: <AutoAwesomeIcon sx={{ fontSize: 40 }} />,
    color: '#7C3AED',
  },
  {
    title: 'Your Dashboard',
    description:
      'See your stats, streaks, and quick actions all in one place. This is your home base.',
    icon: <DashboardIcon sx={{ fontSize: 40 }} />,
    color: '#2563EB',
  },
  {
    title: 'Goal Tree',
    description:
      'Set and track structured goals across every area of your life. Break big ambitions into actionable steps.',
    icon: <AccountTreeIcon sx={{ fontSize: 40 }} />,
    color: '#059669',
  },
  {
    title: 'Find Your Match',
    description:
      'Discover accountability partners based on goal compatibility. Better matches mean better results.',
    icon: <GroupsIcon sx={{ fontSize: 40 }} />,
    color: '#D97706',
  },
  {
    title: 'Chat',
    description:
      'Message your accountability partners directly. Stay connected and keep each other on track.',
    icon: <ChatIcon sx={{ fontSize: 40 }} />,
    color: '#0891B2',
  },
  {
    title: 'Community Feed',
    description:
      'Share updates, celebrate wins, and cheer on others. Your progress inspires the whole community.',
    icon: <DynamicFeedIcon sx={{ fontSize: 40 }} />,
    color: '#DC2626',
  },
  {
    title: 'Coaching Marketplace',
    description:
      'Book sessions with expert coaches who specialize in your goals. Get personalized guidance when you need it.',
    icon: <SchoolIcon sx={{ fontSize: 40 }} />,
    color: '#7C3AED',
  },
  {
    title: 'Praxis Marketplace',
    description:
      'Spend the points you earn on boosts, badges, and premium perks. Achievement has its rewards.',
    icon: <StorefrontIcon sx={{ fontSize: 40 }} />,
    color: '#B45309',
  },
];

interface SiteTourProps {
  open: boolean;
  onClose: () => void;
}

const SiteTour: React.FC<SiteTourProps> = ({ open, onClose }) => {
  const [step, setStep] = useState(0);

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'visible',
        },
      }}
    >
      <DialogContent sx={{ pt: 5, pb: 4, px: 4, textAlign: 'center', position: 'relative' }}>
        {/* Close button */}
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12 }}
          aria-label="close tour"
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        {/* Icon circle */}
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: `${current.color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
            color: current.color,
          }}
        >
          {current.icon}
        </Box>

        {/* Step dots */}
        <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ mb: 2.5 }}>
          {TOUR_STEPS.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: i === step ? current.color : 'transparent',
                border: `2px solid ${i === step ? current.color : 'grey.400'}`,
                borderColor: i === step ? current.color : 'grey.400',
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </Stack>

        {/* Title */}
        <Typography variant="h6" fontWeight={800} gutterBottom>
          {current.title}
        </Typography>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {current.description}
        </Typography>

        {/* Actions */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button
            variant="text"
            color="inherit"
            onClick={handleClose}
            sx={{ color: 'text.secondary', fontWeight: 500 }}
          >
            Skip
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disableElevation
            sx={{
              bgcolor: current.color,
              '&:hover': { bgcolor: current.color, filter: 'brightness(0.9)' },
              borderRadius: 2,
              fontWeight: 700,
              px: 3,
            }}
          >
            {isLast ? 'Done ✓' : 'Next →'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default SiteTour;
