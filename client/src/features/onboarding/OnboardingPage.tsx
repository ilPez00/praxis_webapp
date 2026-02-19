import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  useTheme,
  Avatar,
  IconButton,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { supabase } from '../../lib/supabase';
import { Domain } from '../../models/Domain';
import toast from 'react-hot-toast';

const steps = ['Welcome', 'Profile', 'Interests', 'Finish'];

const DOMAIN_COLORS: Record<Domain, string> = {
  [Domain.CAREER]: '#007AFF',
  [Domain.INVESTING]: '#5856D6',
  [Domain.FITNESS]: '#FF2D55',
  [Domain.ACADEMICS]: '#AF52DE',
  [Domain.MENTAL_HEALTH]: '#32ADE6',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#FF9500',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#FFCC00',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#FF3B30',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#34C759',
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);


  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleComplete();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const toggleDomain = (domain: Domain) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };
  

  const handleComplete = async () => {
    const promise = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user found');

        let avatarUrl: string | null = null;
        if (profilePhotoFile) {
            const { data, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(`${user.id}/${profilePhotoFile.name}`, profilePhotoFile, {
                cacheControl: '3600',
                upsert: true,
            });

            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
            avatarUrl = publicUrlData.publicUrl;
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
            name,
            age: parseInt(age),
            bio,
            avatar_url: avatarUrl,
            onboarding_completed: true,
            })
            .eq('id', user.id);

        if (updateError) throw updateError;

        await supabase.auth.updateUser({
            data: {
            onboarded: true,
            has_photo: !!profilePhotoFile,
            },
        });
        setLoading(false);
        navigate('/goal-selection');
    }

    toast.promise(promise(), {
        loading: 'Saving profile...',
        success: 'Profile saved!',
        error: (err) => `Error: ${err.message}`,
    });
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Welcome
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h3" gutterBottom sx={{ fontWeight: 800, color: 'primary.main' }}>
              Welcome to Praxis
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              The future of human matching. Optimize your life through goal trees and deep compatibility.
            </Typography>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                bgcolor: 'primary.main',
                mx: 'auto',
                fontSize: '3rem',
                boxShadow: '0 8px 32px rgba(0,122,255,0.3)',
              }}
            >
              PX
            </Avatar>
          </Box>
        );
      case 1: // Profile
        return (
          <Box sx={{ maxWidth: 400, mx: 'auto', py: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              Build your identity
            </Typography>
            <TextField
              fullWidth
              label="Full Name"
              variant="outlined"
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ borderRadius: '12px' }}
            />
            <TextField
              fullWidth
              select
              label="Age Range"
              variant="outlined"
              margin="normal"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            >
              {['18', '21', '25', '30', '35', '40', '50'].map((val) => (
                <MenuItem key={val} value={val}>{val}+</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Bio"
              variant="outlined"
              margin="normal"
              multiline
              rows={4}
              placeholder="What drives you?"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Upload a profile photo (optional)
              </Typography>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="profile-photo-upload"
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setProfilePhotoFile(e.target.files[0]);
                    setProfilePhotoPreviewUrl(URL.createObjectURL(e.target.files[0]));
                  } else {
                    setProfilePhotoFile(null);
                    setProfilePhotoPreviewUrl(null);
                  }
                }}
              />
              <label htmlFor="profile-photo-upload">
                <IconButton component="span" sx={{ p: 0 }}>
                  <Avatar
                    src={profilePhotoPreviewUrl || undefined}
                    sx={{
                      width: 80,
                      height: 80,
                      bgcolor: 'primary.light',
                      cursor: 'pointer',
                      border: `2px dashed ${theme.palette.primary.main}`,
                      '&:hover': {
                        opacity: 0.8,
                      },
                    }}
                  >
                    {!profilePhotoPreviewUrl && <CameraAltIcon />}
                  </Avatar>
                </IconButton>
              </label>
              {profilePhotoFile && (
                <Button size="small" color="error" onClick={() => {
                  setProfilePhotoFile(null);
                  setProfilePhotoPreviewUrl(null);
                }} sx={{ mt: 1, display: 'block', mx: 'auto' }}>
                  Remove Photo
                </Button>
              )}
               <Typography variant="caption" display="block" sx={{mt: 2}}>
                Identity verification coming soon – for now, let's build your Praxis profile!
               </Typography>
            </Box>
          </Box>
        );
      case 2: // Interests
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              What areas define you?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Select the domains you want to optimize.
            </Typography>
            <Grid container spacing={1} justifyContent="center">
              {Object.values(Domain).map((domain) => (
                <Grid size="auto" key={domain}>
                  <Chip
                    label={domain}
                    onClick={() => toggleDomain(domain)}
                    sx={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      p: 2,
                      height: 'auto',
                      borderRadius: '12px',
                      backgroundColor: selectedDomains.includes(domain) ? DOMAIN_COLORS[domain] : 'transparent',
                      color: selectedDomains.includes(domain) ? 'white' : 'text.primary',
                      border: `1px solid ${selectedDomains.includes(domain) ? DOMAIN_COLORS[domain] : '#ccc'}`,
                      '&:hover': {
                        backgroundColor: selectedDomains.includes(domain) ? DOMAIN_COLORS[domain] : '#f0f0f0',
                      },
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      case 3: // Finish
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 800 }}>
              All set, {name}!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Your profile is ready. Now let's define your first goals.
            </Typography>
            <CheckCircleIcon sx={{ fontSize: '6rem', color: 'primary.main', mb: 2 }} />
          </Box>
        );
      default:
        return null;
    }
  };

  const isNextDisabled = () => {
    if (activeStep === 1) return !name || !age;
    if (activeStep === 2) return selectedDomains.length === 0;
    return false;
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', py: 6, display: 'flex', flexDirection: 'column' }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 6 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          flexGrow: 1,
          borderRadius: '24px',
          bgcolor: 'background.paper',
          boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {renderStepContent(activeStep)}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
            startIcon={<ArrowBackIosNewIcon />}
            sx={{ borderRadius: '12px', fontWeight: 600 }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled() || loading}
            endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardIosIcon />}
            sx={{
              borderRadius: '12px',
              px: 4,
              py: 1.5,
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0,118,255,0.39)',
            }}
          >
            {activeStep === steps.length - 1 ? 'Start Goal Selection' : 'Continue'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default OnboardingPage;
