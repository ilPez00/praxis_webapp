import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Box,
  Container,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import AppsIcon from '@mui/icons-material/Apps';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useUser } from '../../hooks/useUser';
import LocationMap, { MapMarker } from '../../components/common/LocationMap';
import GlassCard from '../../components/common/GlassCard';
import { useMatches, usePlaces, useEvents } from '../../hooks/useFetch';

// Lazy load the list components for better performance
const MatchesPage = React.lazy(() => import('../matches/MatchesPage'));
const PlacesTab = React.lazy(() => import('../places/PlacesTab'));
const EventsPage = React.lazy(() => import('../events/EventsPage'));

type FilterType = 'all' | 'people' | 'places' | 'events';

const DiscoverPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterType>('all');
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch data using optimized SWR hooks
  const { data: matches, loading: loadingMatches, mutate: mutateMatches } = useMatches(user?.id);
  const { data: places, loading: loadingPlaces, mutate: mutatePlaces } = usePlaces();
  const { data: events, loading: loadingEvents, mutate: mutateEvents } = useEvents();

  const isLoading = loadingMatches || loadingPlaces || loadingEvents;

  // Sync state with URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'places') setFilter('places');
    else if (tabParam === 'events') setFilter('events');
    else if (tabParam === 'people') setFilter('people');
    else setFilter('all');
  }, [location]);

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    const tabName = newFilter === 'all' ? '' : newFilter;
    navigate(tabName ? `/discover?tab=${tabName}` : `/discover`, { replace: true });
  };

  // Get user location for map centering
  useEffect(() => {
    // Priority 1: User Profile Coordinates
    if (user?.latitude && user?.longitude) {
      setUserGeo({ lat: user.latitude, lng: user.longitude });
    }

    // Priority 2: Real-time Geolocation (if permitted)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn('Location access denied'),
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, [user?.latitude, user?.longitude]);

  // Consolidate markers from all data sources
  const allMarkers = useMemo(() => {
    const newMarkers: MapMarker[] = [];

    // Process People
    (matches || []).filter((p: any) => p.latitude && p.longitude).forEach((p: any) => newMarkers.push({
      id: p.userId,
      title: p.name,
      subtitle: p.domains?.join(', '),
      lat: p.latitude,
      lng: p.longitude,
      type: 'user',
      avatarUrl: p.avatarUrl
    }));

    // Process Places
    (places || []).filter((p: any) => p.latitude && p.longitude).forEach((p: any) => newMarkers.push({
      id: p.id,
      title: p.name,
      subtitle: p.type,
      lat: p.latitude,
      lng: p.longitude,
      type: 'place'
    }));

    // Process Events
    (events || []).filter((e: any) => e.latitude && e.longitude).forEach((e: any) => newMarkers.push({
      id: e.id,
      title: e.title,
      subtitle: e.event_date,
      lat: e.latitude,
      lng: e.longitude,
      type: 'event'
    }));

    return newMarkers;
  }, [matches, places, events]);

  const filteredMarkers = useMemo(() => {
    return allMarkers.filter(m => {
      if (filter === 'all') return true;
      if (filter === 'people') return m.type === 'user';
      if (filter === 'places') return m.type === 'place';
      if (filter === 'events') return m.type === 'event';
      return true;
    });
  }, [allMarkers, filter]);

  const handleRefresh = () => {
    mutateMatches();
    mutatePlaces();
    mutateEvents();
  };

  const handleMarkerClick = (id: string, type?: string) => {
    if (type === 'user') navigate(`/profile/${id}`);
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      
      {/* ── 1. Map Section (Hero) ── */}
      <Box sx={{ position: 'relative', height: { xs: '45vh', md: '55vh' }, width: '100%' }}>
        <LocationMap
          height="100%"
          markers={filteredMarkers}
          userLocation={userGeo || undefined}
          onMarkerClick={handleMarkerClick}
        />
        
        {/* Floating Filter Hub */}
        <Box sx={{ 
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', 
          zIndex: 1000, width: '90%', maxWidth: 600 
        }}>
          <GlassCard sx={{ 
            p: 1, borderRadius: '50px', display: 'flex', gap: 1, overflowX: 'auto', 
            justifyContent: 'center', border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }
          }}>
            {[
              { id: 'all', label: t('everything'), icon: <AppsIcon fontSize="small" /> },
              { id: 'people', label: t('people'), icon: <PersonSearchIcon fontSize="small" /> },
              { id: 'places', label: t('places'), icon: <PlaceIcon fontSize="small" /> },
              { id: 'events', label: t('events'), icon: <EventIcon fontSize="small" /> },
            ].map((btn) => (
              <Chip
                key={btn.id}
                icon={btn.icon}
                label={btn.label}
                onClick={() => handleFilterChange(btn.id as FilterType)}
                sx={{
                  height: 40,
                  px: 1,
                  borderRadius: '20px',
                  fontWeight: 800,
                  bgcolor: filter === btn.id ? 'primary.main' : 'rgba(255,255,255,0.05)',
                  color: filter === btn.id ? '#0A0B14' : 'text.primary',
                  border: '1px solid',
                  borderColor: filter === btn.id ? 'primary.main' : 'rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: filter === btn.id ? 'primary.light' : 'rgba(255,255,255,0.1)' },
                  '& .MuiChip-icon': { color: 'inherit' }
                }}
              />
            ))}
          </GlassCard>
        </Box>
      </Box>

      {/* ── 2. Unified List Section ── */}
      <Container maxWidth="lg" sx={{ mt: -4, position: 'relative', zIndex: 2, pb: 10 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {filter === 'all' ? t('community_hub') : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Typography>
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
              {isLoading ? <CircularProgress size={20} /> : <FilterListIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        <React.Suspense fallback={
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>Assembling discovery feed...</Typography>
          </Box>
        }>
          {filter === 'all' && (
            <Stack spacing={6}>
              <Box>
                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900, mb: 2, display: 'block', px: 1 }}>Top User Matches</Typography>
                <MatchesPage compact />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 900, mb: 2, display: 'block', px: 1 }}>Recommended Places</Typography>
                <PlacesTab currentUserId={user?.id} compact hideMap />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: '#EC4899', fontWeight: 900, mb: 2, display: 'block', px: 1 }}>Upcoming Events</Typography>
                <EventsPage compact hideMap />
              </Box>
            </Stack>
          )}
          {filter === 'people' && <MatchesPage />}
          {filter === 'places' && <PlacesTab currentUserId={user?.id} hideMap />}
          {filter === 'events' && <EventsPage hideMap />}
        </React.Suspense>
      </Container>
    </Box>
  );
};

export default DiscoverPage;
