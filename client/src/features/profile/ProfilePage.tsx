import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import TrackerSection from '../trackers/TrackerSection';
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
  Tooltip,
  InputAdornment,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LinkIcon from '@mui/icons-material/Link';
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
  social_instagram?: string;
  social_twitter?: string;
  social_linkedin?: string;
  social_whatsapp?: string;
  social_telegram?: string;
}

const SEX_OPTIONS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];

// Social platform config — key, label, brand colour, URL builder
const SOCIAL_PLATFORMS = [
  {
    key: 'social_instagram' as const,
    label: 'Instagram',
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.12)',
    border: 'rgba(225,48,108,0.3)',
    placeholder: 'username',
    buildUrl: (v: string) => v.startsWith('http') ? v : `https://instagram.com/${v}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    key: 'social_twitter' as const,
    label: 'X / Twitter',
    color: '#E7E9EA',
    bg: 'rgba(231,233,234,0.08)',
    border: 'rgba(231,233,234,0.2)',
    placeholder: 'username',
    buildUrl: (v: string) => v.startsWith('http') ? v : `https://x.com/${v}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    key: 'social_linkedin' as const,
    label: 'LinkedIn',
    color: '#0A66C2',
    bg: 'rgba(10,102,194,0.12)',
    border: 'rgba(10,102,194,0.3)',
    placeholder: 'username or profile URL',
    buildUrl: (v: string) => v.startsWith('http') ? v : `https://linkedin.com/in/${v}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    key: 'social_whatsapp' as const,
    label: 'WhatsApp',
    color: '#25D366',
    bg: 'rgba(37,211,102,0.1)',
    border: 'rgba(37,211,102,0.3)',
    placeholder: 'phone number with country code (e.g. 391234567890)',
    buildUrl: (v: string) => v.startsWith('http') ? v : `https://wa.me/${v.replace(/\D/g, '')}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
  },
  {
    key: 'social_telegram' as const,
    label: 'Telegram',
    color: '#2AABEE',
    bg: 'rgba(42,171,238,0.1)',
    border: 'rgba(42,171,238,0.3)',
    placeholder: 'username',
    buildUrl: (v: string) => v.startsWith('http') ? v : `https://t.me/${v}`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
] as const;

type SocialKey = typeof SOCIAL_PLATFORMS[number]['key'];

const ProfilePage: React.FC = () => {
  const { id: paramId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const isOwnProfile = !paramId || paramId === user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedAge, setEditedAge] = useState('');
  const [editedSex, setEditedSex] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  const [editedSocials, setEditedSocials] = useState<Record<SocialKey, string>>({
    social_instagram: '',
    social_twitter: '',
    social_linkedin: '',
    social_whatsapp: '',
    social_telegram: '',
  });
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
        setEditedSocials({
          social_instagram: data.social_instagram || '',
          social_twitter: data.social_twitter || '',
          social_linkedin: data.social_linkedin || '',
          social_whatsapp: data.social_whatsapp || '',
          social_telegram: data.social_telegram || '',
        });
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
    setLoading(true);
    let avatarUrl = profile?.avatar_url;

    if (selectedAvatarFile) {
      const fileExt = selectedAvatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, selectedAvatarFile, { cacheControl: '3600', upsert: true });
      if (uploadError) {
        const msg = uploadError.message?.toLowerCase().includes('not found')
          ? 'Photo upload failed: "avatars" bucket missing in Supabase Storage. Other changes will still save.'
          : `Photo upload failed: ${uploadError.message}. Other changes will still save.`;
        toast.error(msg);
      } else {
        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path);
        avatarUrl = publicUrlData.publicUrl;
      }
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({
        name: editedName,
        bio: editedBio,
        avatar_url: avatarUrl,
        age: editedAge ? parseInt(editedAge, 10) : null,
        sex: editedSex || null,
        location: editedLocation || null,
        social_instagram: editedSocials.social_instagram.trim() || null,
        social_twitter: editedSocials.social_twitter.trim() || null,
        social_linkedin: editedSocials.social_linkedin.trim() || null,
        social_whatsapp: editedSocials.social_whatsapp.trim() || null,
        social_telegram: editedSocials.social_telegram.trim() || null,
      })
      .eq('id', user.id)
      .select()
      .single();

    setLoading(false);
    if (updateError) {
      toast.error(`Failed to save profile: ${updateError.message}`);
      return;
    }
    setProfile(data);
    setIsEditing(false);
    toast.success('Profile saved!');
  };

  const handleCancel = () => {
    if (profile) {
      setEditedName(profile.name);
      setEditedBio(profile.bio);
      setEditedAge(profile.age ? String(profile.age) : '');
      setEditedSex(profile.sex || '');
      setEditedLocation(profile.location || '');
      setEditedSocials({
        social_instagram: profile.social_instagram || '',
        social_twitter: profile.social_twitter || '',
        social_linkedin: profile.social_linkedin || '',
        social_whatsapp: profile.social_whatsapp || '',
        social_telegram: profile.social_telegram || '',
      });
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

  // Social links that have a value (for view mode)
  const activeSocials = SOCIAL_PLATFORMS.filter(p => profile[p.key]);

  return (
    <Container maxWidth="md" sx={{ mt: 4, pb: 6 }}>
      {/* Hero card */}
      <GlassCard glowColor="rgba(245,158,11,0.1)" sx={{ overflow: 'hidden', mb: 3 }}>
        {/* Banner strip */}
        <Box sx={{
          height: 120,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(139,92,246,0.25) 100%)',
          position: 'relative',
        }} />

        {/* Avatar + info */}
        <Box sx={{ px: 4, pb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: -6, mb: 2 }}>
            {/* Avatar */}
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                src={profilePhotoPreviewUrl || undefined}
                sx={{
                  width: 96, height: 96,
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
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.5)', cursor: 'pointer',
                      opacity: 0, transition: 'opacity 0.2s',
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <CameraAltIcon sx={{ color: 'white', fontSize: 28 }} />
                  </Box>
                </>
              )}
            </Box>

            {/* Edit / Save / Message */}
            {isOwnProfile ? (
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
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate(`/chat/${user?.id}/${paramId}`)}
                sx={{
                  bgcolor: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.35)',
                  color: 'primary.main',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(245,158,11,0.25)' },
                }}
              >
                💬 Message
              </Button>
            )}
          </Box>

          {/* Name + bio */}
          {isOwnProfile && isEditing ? (
            <Stack spacing={2}>
              <TextField label="Name" value={editedName} onChange={e => setEditedName(e.target.value)} fullWidth size="small" />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField label="Age" type="number" value={editedAge} onChange={e => setEditedAge(e.target.value)} fullWidth size="small" inputProps={{ min: 18, max: 120 }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField select label="Sex" value={editedSex} onChange={e => setEditedSex(e.target.value)} fullWidth size="small">
                    <MenuItem value=""><em>Prefer not to say</em></MenuItem>
                    {SEX_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField label="Location" value={editedLocation} onChange={e => setEditedLocation(e.target.value)} fullWidth size="small" placeholder="City, Country" />
                </Grid>
              </Grid>
              <TextField label="Bio" value={editedBio} onChange={e => setEditedBio(e.target.value)} multiline rows={3} fullWidth size="small" />

              {/* Social links edit */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    Social Links
                  </Typography>
                </Box>
                <Stack spacing={1.5}>
                  {SOCIAL_PLATFORMS.map(p => (
                    <TextField
                      key={p.key}
                      label={p.label}
                      value={editedSocials[p.key]}
                      onChange={e => setEditedSocials(prev => ({ ...prev, [p.key]: e.target.value }))}
                      fullWidth
                      size="small"
                      placeholder={p.placeholder}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Box sx={{ color: p.color, display: 'flex', alignItems: 'center' }}>
                              {p.icon}
                            </Box>
                          </InputAdornment>
                        ),
                      }}
                    />
                  ))}
                </Stack>
              </Box>
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
                    sx={{ bgcolor: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: 'primary.main', fontWeight: 600 }}
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
              <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mb: 1 }}>
                {profile.age && <Typography variant="body2" color="text.secondary">Age {profile.age}</Typography>}
                {profile.age && (profile.sex || profile.location) && <Typography variant="body2" color="text.secondary">·</Typography>}
                {profile.sex && <Typography variant="body2" color="text.secondary">{profile.sex}</Typography>}
                {profile.sex && profile.location && <Typography variant="body2" color="text.secondary">·</Typography>}
                {profile.location && <Typography variant="body2" color="text.secondary">📍 {profile.location}</Typography>}
              </Stack>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, mb: activeSocials.length > 0 ? 2 : 0 }}>
                {profile.bio || 'No bio yet.'}
              </Typography>

              {/* Social links view */}
              {activeSocials.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {activeSocials.map(p => (
                    <Tooltip key={p.key} title={p.label}>
                      <Box
                        component="a"
                        href={p.buildUrl(profile[p.key]!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: 1.5,
                          py: 0.6,
                          borderRadius: '8px',
                          bgcolor: p.bg,
                          border: `1px solid ${p.border}`,
                          color: p.color,
                          textDecoration: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          transition: 'opacity 0.15s',
                          '&:hover': { opacity: 0.75 },
                        }}
                      >
                        {p.icon}
                        {p.label}
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Box>
      </GlassCard>

      {/* Trackers — own profile only */}
      {isOwnProfile && (
        <GlassCard glowColor="rgba(245,158,11,0.08)" sx={{ p: 3 }}>
          <TrackerSection userId={user!.id} />
        </GlassCard>
      )}

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
