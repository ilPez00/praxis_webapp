import React, { useState, useEffect } from 'react';
import {
  Container, Box, Typography, CircularProgress, Chip,
  Card, CardContent, Pagination, Stack, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import api from '../../lib/api';

interface Fail {
  id: string;
  fail_type: string;
  goal_name: string | null;
  details: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  byType: Record<string, number>;
}

const FAIL_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  missed_deadline: { label: 'Missed Deadline', icon: <WarningIcon />, color: '#F59E0B' },
  failed_bet: { label: 'Failed Bet', icon: <TrendingDownIcon />, color: '#EF4444' },
  missed_event: { label: 'Missed Event', icon: <EventBusyIcon />, color: '#8B5CF6' },
  missed_checkin: { label: 'Missed Check-in', icon: <LocalFireDepartmentIcon />, color: '#EC4899' },
};

const FailsPage: React.FC = () => {
  const [fails, setFails] = useState<Fail[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);

  const limit = 20;
  const offset = (page - 1) * limit;

  useEffect(() => {
    fetchFails();
    fetchStats();
  }, [page, filter]);

  const fetchFails = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(limit));
      params.append('offset', String(offset));
      if (filter) params.append('type', filter);
      
      const res = await api.get(`/fails?${params.toString()}`);
      setFails(res.data.fails || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch fails:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/fails/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Container maxWidth="sm" sx={{ mt: 4, pb: 8 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
          🤕 Community Fails
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Anonymous stories of missed deadlines and broken streaks — you're not alone.
        </Typography>
      </Box>

      {stats && (
        <Box sx={{ mb: 4, p: 2, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#EF4444' }}>
            This Week: {stats.total} fails across the community
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(stats.byType).map(([type, count]) => (
              <Chip
                key={type}
                size="small"
                icon={FAIL_TYPE_CONFIG[type]?.icon as any}
                label={`${FAIL_TYPE_CONFIG[type]?.label}: ${count}`}
                sx={{ bgcolor: `${FAIL_TYPE_CONFIG[type]?.color}20`, color: FAIL_TYPE_CONFIG[type]?.color }}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={filter || ''}
          exclusive
          onChange={(_, v) => { setFilter(v || null); setPage(1); }}
          size="small"
        >
          <ToggleButton value="">All</ToggleButton>
          {Object.entries(FAIL_TYPE_CONFIG).map(([type, config]) => (
            <ToggleButton key={type} value={type}>
              {config.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : fails.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">No fails yet</Typography>
          <Typography variant="body2" color="text.disabled">Everyone's crushing it!</Typography>
        </Box>
      ) : (
        <>
          <Stack spacing={1.5}>
            {fails.map((fail) => {
              const config = FAIL_TYPE_CONFIG[fail.fail_type];
              return (
                <Card key={fail.id} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ color: config?.color || '#888' }}>
                        {config?.icon || <WarningIcon />}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {config?.label || fail.fail_type}
                        </Typography>
                        {fail.goal_name && (
                          <Typography variant="body2" color="text.secondary">
                            {fail.goal_name}
                          </Typography>
                        )}
                        {fail.details && (
                          <Typography variant="caption" color="text.disabled">
                            {fail.details}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.disabled">
                        {formatTimeAgo(fail.created_at)}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>

          {totalPages > 1 && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default FailsPage;
