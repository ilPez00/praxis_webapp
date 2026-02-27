import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Avatar,
  Rating,
  CircularProgress,
  Alert,
  Divider,
  Stack,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StarIcon from '@mui/icons-material/Star';
import SchoolIcon from '@mui/icons-material/School';
import { useUser } from '../../hooks/useUser';
import { API_URL } from '../../lib/api';
import PostFeed from '../posts/PostFeed';

interface CatalogueItem {
  item_type: string;
  label: string;
  cost: number;
  description: string;
}

interface CoachProfile {
  id: string;
  user_id: string;
  bio: string;
  skills: string[];
  domains: string[];
  rating: number;
  hourly_rate?: number;
  profiles?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

const itemIcon = (type: string) => {
  if (type === 'streak_shield')    return <ShieldIcon sx={{ color: '#60A5FA' }} />;
  if (type === 'profile_boost')    return <RocketLaunchIcon sx={{ color: '#F59E0B' }} />;
  if (type.startsWith('badge_'))   return <EmojiEventsIcon sx={{ color: '#F59E0B' }} />;
  if (type === 'goal_tree_edit')   return <AccountTreeIcon sx={{ color: '#34D399' }} />;
  if (type === 'premium_trial')    return <StarIcon sx={{ color: '#A78BFA' }} />;
  if (type === 'coaching_session') return <SchoolIcon sx={{ color: '#F59E0B' }} />;
  return null;
};

const isOwned = (type: string, user: any): boolean => {
  if (!user) return false;
  if (type === 'streak_shield'    && user.streak_shield)                              return true;
  if (type === 'profile_boost'    && user.profile_boosted_until &&
      new Date(user.profile_boosted_until) > new Date())                              return true;
  if (type === 'badge_apprentice' && user.badge === 'Apprentice')                    return true;
  if (type === 'badge_achiever'   && user.badge === 'Achiever')                      return true;
  if (type === 'badge_legend'     && user.badge === 'Legend')                        return true;
  if (type === 'premium_trial'    && user.is_premium)                                return true;
  return false;
};

const SECTIONS = [
  { label: 'Boosts',  types: ['streak_shield', 'profile_boost'] },
  { label: 'Badges',  types: ['badge_apprentice', 'badge_achiever', 'badge_legend'] },
  { label: 'Skills',  types: ['goal_tree_edit', 'premium_trial'] },
];

const MarketplacePage: React.FC = () => {
  const { user, refetch } = useUser();
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, coachesRes] = await Promise.all([
          fetch(`${API_URL}/marketplace/items`),
          fetch(`${API_URL}/coaches`),
        ]);
        if (itemsRes.ok)   setCatalogue(await itemsRes.json());
        if (coachesRes.ok) setCoaches(await coachesRes.json());
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const buy = async (itemType: string, cost: number, coachUserId?: string) => {
    if (!user) return;
    const key = coachUserId ? `coaching_${coachUserId}` : itemType;
    setPurchasing(key);
    setToast(null);
    try {
      const res = await fetch(`${API_URL}/marketplace/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemType, coachUserId, cost }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Purchase failed.');
      setToast({ type: 'success', message: `Purchased! New balance: ${data.newBalance} pts` });
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message ?? 'Purchase failed.' });
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const points = user?.praxis_points ?? 0;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 3 }, py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Marketplace</Typography>
          <Typography variant="body2" color="text.secondary">Spend your Praxis Points on boosts, badges, and more.</Typography>
        </Box>
        <Chip
          icon={<StarIcon sx={{ color: '#F59E0B !important', fontSize: 18 }} />}
          label={`${points} pts`}
          sx={{
            fontSize: '1rem',
            fontWeight: 800,
            px: 1,
            py: 2.5,
            bgcolor: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#F59E0B',
          }}
        />
      </Box>

      {toast && (
        <Alert
          severity={toast.type}
          onClose={() => setToast(null)}
          sx={{ mb: 3 }}
        >
          {toast.message}
        </Alert>
      )}

      {/* Marketplace Feed */}
      <Box sx={{ mb: 4 }}>
        <PostFeed context="marketplace" />
      </Box>

      {/* Catalogue sections */}
      {SECTIONS.map(section => {
        const items = catalogue.filter(i => section.types.includes(i.item_type));
        if (items.length === 0) return null;
        return (
          <Box key={section.label} sx={{ mb: 4 }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              {section.label}
            </Typography>
            <Grid container spacing={2}>
              {items.map(item => {
                const owned = isOwned(item.item_type, user);
                const canAfford = points >= item.cost;
                const isBuying = purchasing === item.item_type;
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.item_type}>
                    <Card
                      sx={{
                        height: '100%',
                        bgcolor: owned
                          ? 'rgba(52,211,153,0.06)'
                          : 'rgba(255,255,255,0.03)',
                        border: owned
                          ? '1px solid rgba(52,211,153,0.3)'
                          : '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {itemIcon(item.item_type)}
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {item.label}
                          </Typography>
                          {owned && (
                            <Chip label="Active" size="small" color="success" sx={{ ml: 'auto', height: 20, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {item.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                            {item.cost} pts
                          </Typography>
                          <Button
                            variant={owned ? 'outlined' : 'contained'}
                            size="small"
                            disabled={!canAfford || isBuying || owned}
                            onClick={() => buy(item.item_type, item.cost)}
                            startIcon={isBuying ? <CircularProgress size={14} /> : undefined}
                            sx={{ minWidth: 80 }}
                          >
                            {owned ? 'Owned' : isBuying ? 'Buying…' : 'Buy'}
                          </Button>
                        </Box>
                        {!canAfford && !owned && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                            Need {item.cost - points} more pts
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}

      {/* Coaching sessions */}
      {coaches.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            Coaching
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Book a coaching session — your points transfer directly to the coach.
          </Typography>
          <Stack spacing={2}>
            {coaches.filter(c => c.hourly_rate != null).map(coach => {
              const sessionCost = coach.hourly_rate ?? 0;
              const canAfford = points >= sessionCost;
              const coachKey = `coaching_${coach.user_id}`;
              const isBuying = purchasing === coachKey;
              return (
                <Card
                  key={coach.id}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      src={coach.profiles?.avatar_url ?? undefined}
                      sx={{ width: 48, height: 48, border: '2px solid rgba(245,158,11,0.3)' }}
                    >
                      {coach.profiles?.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {coach.profiles?.name ?? 'Coach'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Rating value={coach.rating} precision={0.5} size="small" readOnly />
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(coach.domains ?? []).slice(0, 3).map(d => (
                            <Chip key={d} label={d} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right', minWidth: 'fit-content' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                        {sessionCost} pts/hr
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={!canAfford || isBuying}
                        onClick={() => buy('coaching_session', sessionCost, coach.user_id)}
                        startIcon={isBuying ? <CircularProgress size={14} /> : undefined}
                        sx={{ mt: 0.5, minWidth: 80 }}
                      >
                        {isBuying ? 'Booking…' : 'Book'}
                      </Button>
                      {!canAfford && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                          Need {sessionCost - points} more pts
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default MarketplacePage;
