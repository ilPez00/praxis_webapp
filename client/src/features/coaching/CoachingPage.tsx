import React, { useState } from 'react';
import { Box, Tabs, Tab, Container } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SchoolIcon from '@mui/icons-material/School';
import AICoachPage from './AICoachPage';
import CoachingMarketplace from './CoachingMarketplace';

const CoachingPage: React.FC = () => {
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
            <Tab label="AI Coach" icon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label="Coaching Marketplace" icon={<SchoolIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
        </Container>
      </Box>

      {/* Tab content */}
      {tab === 0 && <AICoachPage />}
      {tab === 1 && <CoachingMarketplace />}
    </Box>
  );
};

export default CoachingPage;
