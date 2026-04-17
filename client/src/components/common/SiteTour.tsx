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
import MenuBookIcon from '@mui/icons-material/MenuBook';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ExploreIcon from '@mui/icons-material/Explore';
import BookIcon from '@mui/icons-material/Book';
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
      'Your daily goal journal and accountability buddy. Track progress, get AI coaching, and connect with people who share your ambitions.',
    icon: <AutoAwesomeIcon sx={{ fontSize: 40 }} />,
    color: '#7C3AED',
  },
  {
    title: 'Your Notebook',
    description:
      'The foundation of Praxis. Create topics, break them into chapters, and fill them with notes. Everything else — coaching, matching, analytics — builds on what you write here.',
    icon: <MenuBookIcon sx={{ fontSize: 40 }} />,
    color: '#F59E0B',
  },
  {
    title: 'Daily Trackers',
    description:
      'Log lifts, cardio, meals, study hours, sleep, expenses, and more in 30 seconds. Your streak, mood, and consistency data paint a clear picture of your habits over time.',
    icon: <TrackChangesIcon sx={{ fontSize: 40 }} />,
    color: '#10B981',
  },
  {
    title: 'Axiom Protocol',
    description:
      'Your AI coach analyzes your progress daily and generates a personalized protocol — morning routine, deep work block, evening reflection, and a challenge to push you forward.',
    icon: <SmartToyIcon sx={{ fontSize: 40 }} />,
    color: '#A78BFA',
  },
  {
    title: 'Discover & Connect',
    description:
      'Find accountability partners matched by goal compatibility. Browse nearby study spots and co-working spaces. Save anyone or anything to your Diary.',
    icon: <ExploreIcon sx={{ fontSize: 40 }} />,
    color: '#EC4899',
  },
  {
    title: 'Your Diary',
    description:
      'A private collection of everything you save — people, places, and personal entries. Export your journey as a plain-text journal anytime.',
    icon: <BookIcon sx={{ fontSize: 40 }} />,
    color: '#6366F1',
  },
  {
    title: 'PP & Marketplace',
    description:
      'Earn Praxis Points through streaks, check-ins, and goal completions. Spend them on boosts, extra goal slots, coaching sessions, and more in the Marketplace.',
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
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12 }}
          aria-label="close tour"
        >
          <CloseIcon fontSize="small" />
        </IconButton>

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

        <Typography variant="h6" fontWeight={800} gutterBottom>
          {current.title}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {current.description}
        </Typography>

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
            {isLast ? 'Get Started' : 'Next'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default SiteTour;
