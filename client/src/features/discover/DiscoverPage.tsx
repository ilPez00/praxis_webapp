import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Tabs, Tab, Container, CircularProgress } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import { useUser } from '../../hooks/useUser';

const MatchesPage = lazy(() => import('../matches/MatchesPage'));
const PlacesTab = lazy(() => import('../places/PlacesTab'));
const EventsPage = lazy(() => import('../events/EventsPage'));

const TabLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
    <CircularProgress />
  </Box>
);

const DiscoverPage: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial tab from URL hash or query if needed, default to 0 (People)
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'places') setTab(1);
    else if (tabParam === 'events') setTab(2);
    else setTab(0);
  }, [location]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
    const tabName = newValue === 1 ? 'places' : newValue === 2 ? 'events' : 'people';
    navigate(`/discover?tab=${tabName}`, { replace: true });
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', pb: 8 }}>
      {/* Sticky tab bar */}
      <Box sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'rgba(17,24,39,0.95)',
        position: 'sticky',
        top: 64,
        zIndex: 10,
        backdropFilter: 'blur(20px)',
      }}>
        <Container maxWidth="lg">
          <Tabs
            value={tab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 3 },
              '& .MuiTab-root': { 
                textTransform: 'none', 
                fontWeight: 700, 
                fontSize: '0.95rem', 
                minHeight: 64,
                color: 'text.disabled',
                '&.Mui-selected': { color: 'primary.main' }
              },
            }}
          >
            <Tab label="People" icon={<PersonSearchIcon sx={{ fontSize: 20 }} />} iconPosition="start" />
            <Tab label="Places" icon={<PlaceIcon sx={{ fontSize: 20 }} />} iconPosition="start" />
            <Tab label="Events" icon={<EventIcon sx={{ fontSize: 20 }} />} iconPosition="start" />
          </Tabs>
        </Container>
      </Box>

      {/* Tab content */}
      <Box sx={{ mt: 2 }}>
        <Suspense fallback={<TabLoader />}>
          {tab === 0 && <MatchesPage />}
          {tab === 1 && <PlacesTab currentUserId={user?.id} />}
          {tab === 2 && <EventsPage />}
        </Suspense>
      </Box>
    </Box>
  );
};

export default DiscoverPage;
