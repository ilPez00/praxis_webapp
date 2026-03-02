import React, { useState } from 'react';
import { Box, Tabs, Tab, Container } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import GroupsIcon from '@mui/icons-material/Groups';
import ForumIcon from '@mui/icons-material/Forum';
import ChatPage from '../chat/ChatPage';
import GroupsPage from '../groups/GroupsPage';
import BoardsPage from '../groups/BoardsPage';

const CommunicationPage: React.FC = () => {
  const [tab, setTab] = useState(0);

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
            <Tab label="Boards" icon={<ForumIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
        </Container>
      </Box>

      {/* Tab content */}
      {tab === 0 && <ChatPage />}
      {tab === 1 && <GroupsPage />}
      {tab === 2 && <BoardsPage />}
    </Box>
  );
};

export default CommunicationPage;
