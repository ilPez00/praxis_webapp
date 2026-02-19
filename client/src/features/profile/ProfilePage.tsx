import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/common/GlassCard';
import {
  Container,
  Box,
  Typography,
  Avatar,
  Button,
  Stack,
  CircularProgress,
  Alert,
  TextField,
  Chip,
  MenuItem,
  Grid,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import toast from 'react-hot-toast';

interface Profile {
  name: string;
  age: number;
  bio: string;
  avatar_url: string;
  onboarding_completed: boolean;
  is_premium?: boolean;
  sex?: string;
  location?: string;
}

const SEX_OPTIONS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

const ProfilePage: React.FC = () => {
  const { id: paramId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // If a :id param is present and different from current user → read-only view
  const isOwnProfile = !paramId || paramId === user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedAge, setEditedAge] = useState('');
  const [editedSex, setEditedSex] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const targetId = paramId || user?.id;
      if (!targetId) { setLoading(false); return; }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetId)
          .single();
        if (error) throw error;
        setProfile(data);
        setEditedName(data.name || '');
        setEditedBio(data.bio || '');
        setEditedAge(data.age ? String(data.age) : '');
        setEditedSex(data.sex || '');
        setEditedLocation(data.location || '');
        setProfilePhotoPreviewUrl(data.avatar_url);
      } catch (err: any) {
        toast.error(`Failed to fetch profile: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) fetchProfile();
  }, [user, authLoading, paramId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedAvatarFile(file);
      setProfilePhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const promise = async () => {
      setLoading(true);
      let avatarUrl = profile?.avatar_url;
      if (selectedAvatarFile) {
        const fileExt = selectedAvatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, selectedAvatarFile, { cacheControl: '3600', upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path);
        avatarUrl = publicUrlData.publicUrl;
      }
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ name: editedName, bio: editedBio, avatar_url: avatarUrl })
        .eq('id', user.id)
        .select()
        .single();
      if (updateError) throw updateError;
      setProfile(data);
      setIsEditing(false);
      setLoading(false);
    };
    toast.promise(promise(), {
      loading: 'Saving profile...',
      success: 'Profile saved!',
      error: (err) => `Error: ${err.message}`,
    });
  };

  const handleCancel = () => {
    if (profile) {
      setEditedName(profile.name);
      setEditedBio(profile.bio);
      setProfilePhotoPreviewUrl(profile.avatar_url);
      setSelectedAvatarFile(null);
    }
    setIsEditing(false);
  };

  if (loading || authLoading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="info">Profile not found.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, pb: 6 }}>
      {/* Hero card */}
      <GlassCard
        glowColor="rgba(245,158,11,0.1)"
        sx={{ overflow: 'hidden', mb: 3 }}
      >
        {/* Banner strip */}
        <Box
          sx={{
            height: 120,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(139,92,246,0.25) 100%)',
            position: 'relative',
          }}
        />

        {/* Avatar + info */}
        <Box sx={{ px: 4, pb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              mt: -6,
              mb: 2,
            }}
          >
            {/* Avatar with camera overlay when editing */}
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                src={profilePhotoPreviewUrl || undefined}
                sx={{
                  width: 96,
                  height: 96,
                  border: '4px solid #111827',
                  fontSize: '2.5rem',
                  cursor: isEditing ? 'pointer' : 'default',
                  transition: 'opacity 0.2s',
                  '&:hover': isEditing ? { opacity: 0.7 } : {},
                }}
                onClick={() => isEditing && document.getElementById('avatar-upload-button')?.click()}
              >
                {profile.name?.charAt(0).toUpperCase()}
              </Avatar>
              {isEditing && (
                <>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="avatar-upload-button"
                    type="file"
                    onChange={handleFileChange}
                  />
                  <Box
                    onClick={() => document.getElementById('avatar-upload-button')?.click()}
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.5)',
                      cursor: 'pointer',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <CameraAltIcon sx={{ color: 'white', fontSize: 28 }} />
                  </Box>
                </>
              )}
            </Box>

            {/* Edit / Save buttons — only shown when viewing own profile */}
            {isOwnProfile && (
              isEditing ? (
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave}>Save</Button>
                  <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleCancel}>Cancel</Button>
                </Stack>
              ) : (
                <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              )
            )}
          </Box>

          {/* Name + bio */}
          {isOwnProfile && isEditing ? (
            <Stack spacing={2}>
              <TextField
                label="Name"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Bio"
                value={editedBio}
                onChange={(e) => setEditedBio(e.target.value)}
                multiline
                rows={3}
                fullWidth
                size="small"
              />
            </Stack>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.75 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{profile.name}</Typography>
                {profile.is_premium && (
                  <Chip
                    icon={<WorkspacePremiumIcon sx={{ fontSize: '14px !important' }} />}
                    label="Premium"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(245,158,11,0.15)',
                      border: '1px solid rgba(245,158,11,0.35)',
                      color: 'primary.main',
                      fontWeight: 600,
                    }}
                  />
                )}
                {profile.onboarding_completed && (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: '14px !important', color: '#10B981 !important' }} />}
                    label="Onboarded"
                    size="small"
                    sx={{ bgcolor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontWeight: 600 }}
                  />
                )}
              </Box>
              {profile.age && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Age {profile.age}
                </Typography>
              )}
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {profile.bio || 'No bio yet.'}
              </Typography>
            </Box>
          )}
        </Box>
      </GlassCard>

      {/* Goal Tree shortcut */}
      <GlassCard glowColor="rgba(139,92,246,0.12)" sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AccountTreeIcon sx={{ color: 'secondary.main' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {isOwnProfile ? 'Your Goal Tree' : `${profile.name}'s Goal Tree`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isOwnProfile ? 'Visualize and manage your hierarchical goals.' : 'View their goal architecture.'}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            color="secondary"
            onClick={() => navigate(`/goals/${paramId || user?.id}`)}
          >
            View Tree
          </Button>
        </Box>
      </GlassCard>
    </Container>
  );
};

export default ProfilePage;
