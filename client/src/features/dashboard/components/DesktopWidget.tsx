import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack, IconButton, CircularProgress } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../../../lib/supabase';
import axios from 'axios';
import { API_URL } from '../../../lib/api';

const DesktopWidget: React.FC = () => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: { session } } = await supabase.auth.getSession();
          const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
          const res = await axios.get(`${API_URL}/users/${user.id}`, { headers });
          setUserData(res.data);
        }
      } catch (error) {
        console.error('Error fetching widget data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'transparent' }}>
        <CircularProgress size={24} sx={{ color: '#F97316' }} />
      </Box>
    );
  }

  if (!userData) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(10, 11, 20, 0.8)', borderRadius: 2, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
        <Typography variant="body2" color="white">Please login to Praxis</Typography>
      </Box>
    );
  }

  return (
    <Box 
      className="draggable"
      sx={{ 
        p: 1.5, 
        bgcolor: 'rgba(10, 11, 20, 0.85)', 
        backdropFilter: 'blur(10px)',
        borderRadius: '16px', 
        border: '1px solid rgba(249, 115, 22, 0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        width: 'fit-content',
        minWidth: '180px',
        color: 'white',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
          PRAXIS
        </Typography>
        <IconButton 
          size="small" 
          onClick={() => (window as any).electron?.closeWidget()}
          sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white' } }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Stack>

      <Stack spacing={1.5}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 24 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1, color: '#F97316' }}>
                {userData.streak || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', fontWeight: 700 }}>
                STREAK
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#3B82F6', fontSize: 20 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1, color: '#3B82F6' }}>
                {userData.praxisPoints || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', fontWeight: 700 }}>
                POINTS
              </Typography>
            </Box>
          </Box>
        </Stack>

        {userData.topGoal && (
          <Box sx={{ pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontSize: '0.55rem', fontWeight: 800 }}>
              NEXT GOAL
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              {userData.topGoal.emoji} {userData.topGoal.name}
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default DesktopWidget;
