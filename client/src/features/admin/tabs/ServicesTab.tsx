import React, { useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import HandshakeIcon from '@mui/icons-material/Handshake';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { AdminService, ConfirmAction, downloadCSV } from './adminTypes';

interface ServicesTabProps {
  services: AdminService[];
  loading: boolean;
  fetchServices: () => Promise<void>;
}

const ServicesTab: React.FC<ServicesTabProps> = ({ services, loading, fetchServices }) => {
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [acting, setActing] = useState(false);

  const handleDeleteService = async (serviceId: string) => {
    setActing(true);
    try {
      await api.delete(`/admin/services/${serviceId}`);
      fetchServices(); toast.success('Service deleted.');
    } catch { toast.error('Failed to delete service.'); } finally { setActing(false); setConfirm(null); }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Services & Listings</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadCSV(services as unknown as Record<string, unknown>[], 'praxis-services.csv')}
            disabled={services.length === 0}
            sx={{ borderRadius: 2 }}
          >
            Download CSV
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchServices} disabled={loading} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : services.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <HandshakeIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">No services listed yet.</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>User</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Domain</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map(s => (
                <TableRow key={s.id} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {s.user_name || s.user_id.slice(0, 8)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.type}
                      size="small"
                      sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(99,102,241,0.12)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.25)' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{s.domain || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {s.price != null ? `${s.price} ${s.price_currency || 'EUR'}` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.active ? 'active' : 'inactive'}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.65rem',
                        bgcolor: s.active ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.12)',
                        color: s.active ? '#4ADE80' : 'text.secondary',
                        border: `1px solid ${s.active ? 'rgba(34,197,94,0.25)' : 'rgba(107,114,128,0.2)'}`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.disabled">{new Date(s.created_at).toLocaleDateString()}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete service">
                      <IconButton size="small" onClick={() => setConfirm({ type: 'delete-service', service: s })}
                        sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={confirm?.type === 'delete-service'} onClose={() => !acting && setConfirm(null)} maxWidth="xs" fullWidth>
        {confirm?.type === 'delete-service' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete service?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Permanently delete <strong>{confirm.service.title}</strong>?{' '}
                <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Cannot be undone.</Box>
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleDeleteService(confirm.service.id)}>
                Delete permanently
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default ServicesTab;
