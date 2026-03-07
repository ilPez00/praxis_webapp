import React, { useState } from 'react';
import { Box, Tabs, Tab, Container } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import GroupsIcon from '@mui/icons-material/Groups';
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/Place';
import ChatPage from '../chat/ChatPage';
import GroupsPage from '../groups/GroupsPage';
import EventsPage from '../events/EventsPage';
import PlacesTab from '../places/PlacesTab';
import { useUser } from '../../hooks/useUser';

const CommunicationPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const { user } = useUser();

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Sticky tab bar */}
      <Box sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'rgba(17,24,39,0.9)',
        position: 'sticky',
        top: 64,
        zIndex: 10,
        backdropFilter: 'blur(20px)',
      }}>
        <Container maxWidth="lg">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', minHeight: 52 },
            }}
          >
            <Tab label="Messages" icon={<ChatIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label="Groups" icon={<GroupsIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label="Events" icon={<EventIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label="Places" icon={<PlaceIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
        </Container>
      </Box>

      {/* Tab content */}
      {tab === 0 && <ChatPage />}
      {tab === 1 && <GroupsPage />}
      {tab === 2 && <EventsPage />}
      {tab === 3 && <PlacesTab currentUserId={user?.id} />}
    </Box>
  );
};

export default CommunicationPage;
