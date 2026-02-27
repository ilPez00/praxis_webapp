import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS, Domain } from '../../types/goal';
import GlassCard from '../../components/common/GlassCard';
import PostFeed from '../posts/PostFeed';

import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Stack,
  CircularProgress,
  Divider,
  IconButton,
  Rating,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ChatIcon from '@mui/icons-material/Chat';
import SchoolIcon from '@mui/icons-material/School';
import VerifiedIcon from '@mui/icons-material/Verified';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import DeleteIcon from '@mui/icons-material/Delete';

interface CoachProfile {
  id: string;
  user_id: string;
  bio: string;
  skills: string[];
  domains: string[];
  hourly_rate: number | null;
  is_available: boolean;
  rating: number;
  total_reviews: number;
  similarity?: number;
  profiles?: {
    id: string;
    name: string;
    avatar_url: string | null;
    is_verified: boolean;
    is_premium: boolean;
  };
}

const domainOptions = Object.values(Domain);

const CoachingPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<CoachProfile | null>(null);
  const [checkingMyProfile, setCheckingMyProfile] = useState(true);

  // Edit/create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formBio, setFormBio] = useState('');
  const [formSkills, setFormSkills] = useState(''); // comma-separated
  const [formDomains, setFormDomains] = useState<string[]>([]);
  const [formRate, setFormRate] = useState('');
  const [formAvailable, setFormAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);

  const fetchCoaches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/coaches`, {
        params: currentUserId ? { userId: currentUserId } : {},
      });
      setCoaches(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const fetchMyProfile = useCallback(async () => {
    if (!currentUserId) return;
    setCheckingMyProfile(true);
    try {
      const res = await axios.get(`${API_URL}/coaches/${currentUserId}`);
      setMyProfile(res.data);
    } catch {
      setMyProfile(null);
    } finally {
      setCheckingMyProfile(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchCoaches();
      fetchMyProfile();
    }
  }, [fetchCoaches, fetchMyProfile, currentUserId]);

  const openCreateDialog = () => {
    if (myProfile) {
      setFormBio(myProfile.bio);
      setFormSkills(myProfile.skills.join(', '));
      setFormDomains(myProfile.domains);
      setFormRate(myProfile.hourly_rate !== null ? String(myProfile.hourly_rate) : '');
      setFormAvailable(myProfile.is_available);
    } else {
      setFormBio('');
      setFormSkills('');
      setFormDomains([]);
      setFormRate('');
      setFormAvailable(true);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentUserId || !formBio.trim()) return;
    setSaving(true);
    try {
      const skills = formSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await axios.post(`${API_URL}/coaches`, {
        userId: currentUserId,
        bio: formBio.trim(),
        skills,
        domains: formDomains,
        hourlyRate: formRate ? parseFloat(formRate) : null,
        isAvailable: formAvailable,
      });
      toast.success(myProfile ? 'Profile updated!' : 'Coach profile created!');
      setDialogOpen(false);
      fetchMyProfile();
      fetchCoaches();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUserId) return;
    try {
      await axios.delete(`${API_URL}/coaches/${currentUserId}`);
      toast.success('Coach profile removed.');
      setMyProfile(null);
      fetchCoaches();
    } catch {
      toast.error('Failed to remove profile.');
    }
  };

  const handleContact = (coach: CoachProfile) => {
    if (!currentUserId) return;
    navigate(`/chat/${currentUserId}/${coach.user_id}`);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(245,158,11,0.15)', color: 'primary.main' }}>
              <SchoolIcon />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
              Coaching Marketplace
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 580 }}>
            Connect with experienced coaches who share your goal domains. Coaches are ranked by domain
            alignment with your goals and overall rating.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          {myProfile && (
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              color="error"
              sx={{ borderRadius: '12px' }}
            >
              Remove Profile
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={myProfile ? <EditIcon /> : <AddIcon />}
            onClick={openCreateDialog}
            disabled={checkingMyProfile}
            sx={{ borderRadius: '12px', fontWeight: 700 }}
          >
            {myProfile ? 'Edit My Listing' : 'Become a Coach'}
          </Button>
        </Stack>
      </Box>

      {/* My coach profile banner */}
      {myProfile && (
        <GlassCard
          sx={{
            p: 3,
            mb: 4,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '20px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Avatar
              src={user?.avatarUrl || undefined}
              sx={{ width: 52, height: 52, border: '2px solid rgba(245,158,11,0.4)' }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Your coaching listing is live
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {(myProfile.bio ?? '').slice(0, 120)}{(myProfile.bio ?? '').length > 120 ? '…' : ''}
              </Typography>
            </Box>
            <Chip
              icon={<StarIcon sx={{ color: '#F59E0B !important', fontSize: '14px !important' }} />}
              label={`${myProfile.rating?.toFixed(1) ?? '—'} rating`}
              sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: 'primary.main', fontWeight: 700 }}
            />
            {myProfile.hourly_rate && (
              <Chip
                icon={<LocalOfferIcon sx={{ fontSize: '14px !important' }} />}
                label={`$${myProfile.hourly_rate}/hr`}
                sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontWeight: 600 }}
              />
            )}
          </Box>
        </GlassCard>
      )}

      {/* Coaching Feed */}
      <Box sx={{ mb: 4 }}>
        <PostFeed context="coaching" />
      </Box>

      {/* Coach grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : coaches.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 12 }}>
          <SchoolIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
            No coaches yet
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5, mb: 3 }}>
            Be the first to list yourself as a coach!
          </Typography>
          <Button variant="contained" onClick={openCreateDialog} sx={{ borderRadius: '12px' }}>
            Become a Coach
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {coaches.map((coach) => {
            const profile = coach.profiles;
            const displayName = profile?.name ?? 'Praxis Coach';
            const isMe = coach.user_id === currentUserId;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={coach.id}>
                <GlassCard
                  sx={{
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    border: isMe
                      ? '1px solid rgba(245,158,11,0.3)'
                      : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '20px',
                    transition: 'border-color 0.2s, transform 0.2s',
                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                  }}
                >
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar
                      src={profile?.avatar_url || undefined}
                      sx={{ width: 52, height: 52, border: '2px solid rgba(255,255,255,0.1)' }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                          {displayName}
                        </Typography>
                        {profile?.is_verified && (
                          <Tooltip title="Verified">
                            <VerifiedIcon sx={{ fontSize: 16, color: '#3B82F6' }} />
                          </Tooltip>
                        )}
                        {isMe && (
                          <Chip label="You" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245,158,11,0.15)', color: 'primary.main' }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                        <Rating value={coach.rating ?? 0} readOnly precision={0.5} size="small" sx={{ fontSize: '0.9rem' }} />
                        <Typography variant="caption" color="text.secondary">
                          ({coach.total_reviews ?? 0})
                        </Typography>
                      </Box>
                    </Box>
                    {coach.similarity !== undefined && coach.similarity > 0 && (
                      <Chip
                        label={`${coach.similarity}% match`}
                        size="small"
                        sx={{
                          bgcolor: `rgba(16,185,129,0.1)`,
                          color: '#10B981',
                          border: '1px solid rgba(16,185,129,0.3)',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                        }}
                      />
                    )}
                  </Box>

                  {/* Bio */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      flexGrow: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.6,
                    }}
                  >
                    {coach.bio}
                  </Typography>

                  {/* Domains */}
                  {(coach.domains ?? []).length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {(coach.domains ?? []).slice(0, 3).map((d) => (
                        <Chip
                          key={d}
                          label={`${DOMAIN_ICONS[d] ?? ''} ${d}`}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.68rem',
                            bgcolor: `${DOMAIN_COLORS[d] ?? '#9CA3AF'}15`,
                            color: DOMAIN_COLORS[d] ?? '#9CA3AF',
                            border: `1px solid ${DOMAIN_COLORS[d] ?? '#9CA3AF'}30`,
                          }}
                        />
                      ))}
                      {(coach.domains ?? []).length > 3 && (
                        <Chip
                          label={`+${(coach.domains ?? []).length - 3}`}
                          size="small"
                          sx={{ height: 22, fontSize: '0.68rem', bgcolor: 'rgba(255,255,255,0.06)' }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Skills */}
                  {(coach.skills ?? []).length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(coach.skills ?? []).slice(0, 4).map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            borderColor: 'rgba(255,255,255,0.1)',
                            color: 'text.secondary',
                          }}
                        />
                      ))}
                    </Box>
                  )}

                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

                  {/* Footer */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      {coach.hourly_rate ? (
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          ${coach.hourly_rate}/hr
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          Rate negotiable
                        </Typography>
                      )}
                      {!coach.is_available && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled' }}>
                          Currently unavailable
                        </Typography>
                      )}
                    </Box>
                    {!isMe && (
                      <Button
                        variant={coach.is_available ? 'contained' : 'outlined'}
                        size="small"
                        startIcon={<ChatIcon />}
                        onClick={() => handleContact(coach)}
                        disabled={!coach.is_available}
                        sx={{ borderRadius: '10px', fontWeight: 600 }}
                      >
                        Contact
                      </Button>
                    )}
                  </Box>
                </GlassCard>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {myProfile ? 'Edit Coach Profile' : 'Become a Coach'}
              </Typography>
            </Box>
            <IconButton onClick={() => setDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="About you (bio)"
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              fullWidth
              multiline
              rows={3}
              required
              inputProps={{ maxLength: 400 }}
              helperText={`${formBio.length}/400 — Describe your experience and coaching style`}
            />
            <TextField
              label="Skills (comma-separated)"
              value={formSkills}
              onChange={(e) => setFormSkills(e.target.value)}
              fullWidth
              placeholder="e.g. Accountability, Habit Building, Goal Setting"
              helperText="Enter skills separated by commas"
            />
            <FormControl fullWidth>
              <InputLabel>Domains you coach</InputLabel>
              <Select
                multiple
                value={formDomains}
                onChange={(e) => setFormDomains(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[])}
                input={<OutlinedInput label="Domains you coach" />}
                renderValue={(selected: string[]) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((v) => (
                      <Chip key={v} label={v} size="small" sx={{ height: 22, fontSize: '0.7rem' }} />
                    ))}
                  </Box>
                )}
              >
                {domainOptions.map((d) => (
                  <MenuItem key={d} value={d}>
                    {DOMAIN_ICONS[d] ?? ''} {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Hourly rate (USD, optional)"
              value={formRate}
              onChange={(e) => setFormRate(e.target.value)}
              fullWidth
              type="number"
              inputProps={{ min: 0, step: 5 }}
              placeholder="Leave blank if free or negotiable"
            />
            <FormControl fullWidth>
              <InputLabel>Availability</InputLabel>
              <Select
                value={formAvailable ? 'available' : 'unavailable'}
                onChange={(e) => setFormAvailable(e.target.value === 'available')}
                label="Availability"
              >
                <MenuItem value="available">Available for coaching</MenuItem>
                <MenuItem value="unavailable">Not available right now</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formBio.trim()}
            sx={{ borderRadius: '10px', fontWeight: 700, minWidth: 100 }}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : myProfile ? 'Save Changes' : 'Create Listing'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CoachingPage;
