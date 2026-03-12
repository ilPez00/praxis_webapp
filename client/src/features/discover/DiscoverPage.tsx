import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Container,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import AppsIcon from '@mui/icons-material/Apps';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useUser } from '../../hooks/useUser';
import { API_URL } from '../../lib/api';
import LocationMap, { MapMarker } from '../../components/common/LocationMap';
import GlassCard from '../../components/common/GlassCard';

// Lazy load the list components for better performance
const MatchesPage = React.lazy(() => import('../matches/MatchesPage'));
const PlacesTab = React.lazy(() => import('../places/PlacesTab'));
const EventsPage = React.lazy(() => import('../events/EventsPage'));

type FilterType = 'all' | 'people' | 'places' | 'events';

const DiscoverPage: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterType>('all');
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loadingMarkers, setLoadingLoadingMarkers] = useState(true);
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);

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
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn('Location access denied'),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const fetchMarkers = useCallback(async () => {
    if (!user?.id) return;
    setLoadingLoadingMarkers(true);
    try {
      const { data: { session } } = await axios.get(`${API_URL}/auth/session`).catch(() => ({ data: { session: null } }));
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      // Fetch all 3 types in parallel
      const [peopleRes, placesRes, eventsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/matches/${user.id}`, { headers }),
        axios.get(`${API_URL}/places`, { headers }),
        axios.get(`${API_URL}/events`, { headers })
      ]);

      const newMarkers: MapMarker[] = [];

      // Process People
      if (peopleRes.status === 'fulfilled') {
        const people = (peopleRes.value.data || []).filter((p: any) => p.latitude && p.longitude);
        people.forEach((p: any) => newMarkers.push({
          id: p.userId,
          title: p.name,
          subtitle: p.domains?.join(', '),
          lat: p.latitude,
          lng: p.longitude,
          type: 'user',
          avatarUrl: p.avatarUrl
        }));
      }

      // Process Places
      if (placesRes.status === 'fulfilled') {
        const places = (placesRes.value.data || []).filter((p: any) => p.latitude && p.longitude);
        places.forEach((p: any) => newMarkers.push({
          id: p.id,
          title: p.name,
          subtitle: p.type,
          lat: p.latitude,
          lng: p.longitude,
          type: 'place'
        }));
      }

      // Process Events
      if (eventsRes.status === 'fulfilled') {
        const events = (eventsRes.value.data || []).filter((e: any) => e.latitude && e.longitude);
        events.forEach((e: any) => newMarkers.push({
          id: e.id,
          title: e.title,
          subtitle: e.event_date,
          lat: e.latitude,
          lng: e.longitude,
          type: 'event'
        }));
      }

      setMarkers(newMarkers);
    } catch (err) {
      console.error('Failed to load markers:', err);
    } finally {
      setLoadingLoadingMarkers(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMarkers();
  }, [fetchMarkers]);

  const filteredMarkers = markers.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'people') return m.type === 'user';
    if (filter === 'places') return m.type === 'place';
    if (filter === 'events') return m.type === 'event';
    return true;
  });

  const handleMarkerClick = (id: string, type?: string) => {
    if (type === 'user') navigate(`/profile/${id}`);
    // For others, let the popup handle it or scroll to item
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
              { id: 'all', label: 'Everything', icon: <AppsIcon fontSize="small" /> },
              { id: 'people', label: 'Users', icon: <PersonSearchIcon fontSize="small" /> },
              { id: 'places', label: 'Places', icon: <PlaceIcon fontSize="small" /> },
              { id: 'events', label: 'Events', icon: <EventIcon fontSize="small" /> },
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
            {filter === 'all' ? 'Community Hub' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Typography>
          <Tooltip title="Refresh data">
            <IconButton onClick={fetchMarkers} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
              {loadingMarkers ? <CircularProgress size={20} /> : <FilterListIcon />}
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
                <PlacesTab currentUserId={user?.id} compact />
              </Box>
              <Box>
                <Typography variant="overline" sx={{ color: '#EC4899', fontWeight: 900, mb: 2, display: 'block', px: 1 }}>Upcoming Events</Typography>
                <EventsPage compact />
              </Box>
            </Stack>
          )}
          {filter === 'people' && <MatchesPage />}
          {filter === 'places' && <PlacesTab currentUserId={user?.id} />}
          {filter === 'events' && <EventsPage />}
        </React.Suspense>
      </Container>
    </Box>
  );
};

export default DiscoverPage;
