import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import SchoolIcon from '@mui/icons-material/School';
import { AdminCoach, downloadCSV } from './adminTypes';

interface CoachesTabProps {
  coaches: AdminCoach[];
  loading: boolean;
  fetchCoaches: () => Promise<void>;
}

const CoachesTab: React.FC<CoachesTabProps> = ({ coaches, loading, fetchCoaches }) => {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Coach Profiles</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadCSV(coaches as unknown as Record<string, unknown>[], 'praxis-coaches.csv')}
            disabled={coaches.length === 0}
            sx={{ borderRadius: 2 }}
          >
            Download CSV
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchCoaches} disabled={loading} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : coaches.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <SchoolIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">No coach profiles yet (or table not created).</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>User ID</TableCell>
                <TableCell>Bio</TableCell>
                <TableCell>Domains</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Rate/hr</TableCell>
                <TableCell>Available</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {coaches.map(c => (
                <TableRow key={c.id} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {c.user_id.slice(0, 8)}…
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.bio || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 180 }}>
                      {(c.domains ?? []).slice(0, 3).map(d => (
                        <Chip key={d} label={d} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
                      ))}
                      {(c.domains ?? []).length > 3 && (
                        <Typography variant="caption" color="text.disabled">+{(c.domains ?? []).length - 3}</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: c.rating != null ? '#FBBF24' : 'text.disabled' }}>
                      {c.rating != null ? c.rating.toFixed(1) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {c.hourly_rate != null ? `€${c.hourly_rate}` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={c.is_available ? 'yes' : 'no'}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.65rem',
                        bgcolor: c.is_available ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.12)',
                        color: c.is_available ? '#4ADE80' : 'text.secondary',
                        border: `1px solid ${c.is_available ? 'rgba(34,197,94,0.25)' : 'rgba(107,114,128,0.2)'}`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.disabled">{new Date(c.created_at).toLocaleDateString()}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

export default CoachesTab;
