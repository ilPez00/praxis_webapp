import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Avatar,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';

interface AdminUser {
  id: string;
  email?: string;
  name?: string;
  is_demo?: boolean;
  is_admin?: boolean;
  is_premium?: boolean;
  onboarding_completed?: boolean;
  created_at: string;
}

const AdminPage: React.FC = () => {
  const { user } = useUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to fetch users.');
      }
    } catch (err) {
      toast.error('Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) fetchUsers();
  }, [user, fetchUsers]);

  const handleDeleteUser = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/admin/users/${confirmDeleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== confirmDeleteId));
        toast.success('User deleted.');
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error((body as any).message || 'Failed to delete user.');
      }
    } catch (err) {
      toast.error('Failed to delete user.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  if (!user?.is_admin) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <AdminPanelSettingsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" color="error.main" sx={{ fontWeight: 700 }}>Access Denied</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Admin access required.</Typography>
      </Container>
    );
  }

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const realUsers = users.filter(u => !u.is_demo).length;
  const demoUsers = users.filter(u => u.is_demo).length;
  const confirmTarget = users.find(u => u.id === confirmDeleteId);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AdminPanelSettingsIcon sx={{ fontSize: 28, color: 'error.main', display: 'block' }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Admin Panel</Typography>
          <Typography variant="body2" color="text.secondary">Godmode enabled — handle with care</Typography>
        </Box>
      </Box>

      {/* Stats row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Users', value: users.length, color: 'primary.main' },
          { label: 'Real Users', value: realUsers, color: 'success.main' },
          { label: 'Demo Users', value: demoUsers, color: 'warning.main' },
        ].map(stat => (
          <Card key={stat.label} sx={{ flex: '1 1 120px', minWidth: 120 }}>
            <CardContent sx={{ textAlign: 'center', py: '16px !important' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: stat.color }}>{stat.value}</Typography>
              <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Search */}
      <TextField
        size="small"
        placeholder="Search by name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2, width: 380 }}
      />

      {/* Users table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(u => (
                <TableRow
                  key={u.id}
                  sx={{
                    opacity: u.is_demo ? 0.65 : 1,
                    '&:last-child td': { border: 0 },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                        {(u.name || u.email || '?')[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                          {u.name || '—'}
                        </Typography>
                        {u.id === user.id && (
                          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>you</Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{u.email || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {u.is_demo && (
                        <Chip label="demo" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245,158,11,0.12)', color: 'warning.main', border: '1px solid rgba(245,158,11,0.25)' }} />
                      )}
                      {u.is_admin && (
                        <Chip label="admin" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.12)', color: 'error.main', border: '1px solid rgba(239,68,68,0.25)' }} />
                      )}
                      {u.is_premium && (
                        <Chip label="premium" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(139,92,246,0.12)', color: 'secondary.main', border: '1px solid rgba(139,92,246,0.25)' }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.disabled">
                      {new Date(u.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {u.id !== user.id && (
                      <IconButton
                        size="small"
                        onClick={() => setConfirmDeleteId(u.id)}
                        sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDeleteId} onClose={() => !deleting && setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete User?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Permanently delete <strong>{confirmTarget?.name || confirmTarget?.email}</strong>?
            This removes their auth account, profile, goals, and all associated data.
            <Box component="span" sx={{ display: 'block', mt: 1, color: 'error.main', fontWeight: 600 }}>
              This cannot be undone.
            </Box>
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDeleteId(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteUser}
            disabled={deleting}
            endIcon={deleting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminPage;
