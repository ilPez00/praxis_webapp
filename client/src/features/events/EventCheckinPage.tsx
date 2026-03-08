import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Box, Typography, CircularProgress, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { API_URL } from '../../lib/api';
import { supabase } from '../../lib/supabase';

type State = 'loading' | 'success' | 'already' | 'error';

const EventCheckinPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);

  // Extract event id from the referrer path or use a param
  // QR URL is: /events/checkin?token=<token>&eventId=<id>
  const token = searchParams.get('token');
  const eventId = searchParams.get('eventId');

  useEffect(() => {
    if (!token || !eventId) {
      setState('error');
      setMessage('Invalid check-in link. Missing token or event ID.');
      return;
    }

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to login, preserving the check-in URL
        navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      try {
        const res = await axios.post(
          `${API_URL}/events/${eventId}/checkin`,
          { token },
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const { alreadyCheckedIn, newBalance: bal } = res.data as { alreadyCheckedIn: boolean; newBalance: number };
        setNewBalance(bal);
        setState(alreadyCheckedIn ? 'already' : 'success');
        setMessage(alreadyCheckedIn ? 'You already checked in to this event.' : `+50 PP awarded! New balance: ${bal} PP`);
      } catch (err: any) {
        setState('error');
        setMessage(err.response?.data?.message || 'Check-in failed. The token may have expired.');
      }
    })();
  }, [token, eventId, navigate]);

  return (
    <Container maxWidth="xs" sx={{ mt: 10, textAlign: 'center' }}>
      {state === 'loading' && (
        <Box>
          <CircularProgress size={48} />
          <Typography sx={{ mt: 2 }} color="text.secondary">Checking you in…</Typography>
        </Box>
      )}
      {(state === 'success' || state === 'already') && (
        <Box>
          <CheckCircleIcon sx={{ fontSize: 64, color: state === 'success' ? '#10B981' : '#F59E0B', mb: 2 }} />
          <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
            {state === 'success' ? 'Checked in!' : 'Already checked in'}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>{message}</Typography>
          <Button variant="contained" onClick={() => navigate('/communication')}>Back to Events</Button>
        </Box>
      )}
      {state === 'error' && (
        <Box>
          <ErrorIcon sx={{ fontSize: 64, color: '#EF4444', mb: 2 }} />
          <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>Check-in failed</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>{message}</Typography>
          <Button variant="outlined" onClick={() => navigate('/communication')}>Back to Events</Button>
        </Box>
      )}
    </Container>
  );
};

export default EventCheckinPage;
