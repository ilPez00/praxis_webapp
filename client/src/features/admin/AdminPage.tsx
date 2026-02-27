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
  Tooltip,
  Divider,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SearchIcon from '@mui/icons-material/Search';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import RefreshIcon from '@mui/icons-material/Refresh';
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
  banned_until?: string | null;
  created_at: string;
}

type ConfirmAction =
  | { type: 'delete'; user: AdminUser }
  | { type: 'ban'; user: AdminUser }
  | { type: 'delete-demo' }
  | null;

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

const AdminPage: React.FC = () => {
  const { user } = useUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [acting, setActing] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        toast.error('Failed to fetch users.');
      }
    } catch {
      toast.error('Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) fetchUsers();
  }, [user, fetchUsers]);

  const isBanned = (u: AdminUser) =>
    !!u.banned_until && new Date(u.banned_until) > new Date();

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDeleteUser = async (userId: string) => {
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        toast.success('User deleted permanently.');
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error((body as any).message || 'Failed to delete user.');
      }
    } catch {
      toast.error('Failed to delete user.');
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  const handleBanUser = async (userId: string) => {
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, banned_until: new Date(Date.now() + 876000 * 3600 * 1000).toISOString() } : u
        ));
        toast.success('User banned.');
      } else {
        toast.error('Failed to ban user.');
      }
    } catch {
      toast.error('Failed to ban user.');
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, banned_until: null } : u
        ));
        toast.success('User unbanned.');
      } else {
        toast.error('Failed to unban user.');
      }
    } catch {
      toast.error('Failed to unban user.');
    }
  };

  const handleDeleteAllDemo = async () => {
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/demo-users`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        setUsers(prev => prev.filter(u => !u.is_demo));
        toast.success(body.message || 'Demo users deleted.');
      } else {
        toast.error('Failed to delete demo users.');
      }
    } catch {
      toast.error('Failed to delete demo users.');
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/seed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        toast.success(body.message || 'Demo users seeded.');
        await fetchUsers();
      } else {
        toast.error('Failed to seed demo users.');
      }
    } catch {
      toast.error('Failed to seed demo users.');
    } finally {
      setSeedingDemo(false);
    }
  };

  // ── Access guard ────────────────────────────────────────────────────────────

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

  const demoCount = users.filter(u => u.is_demo).length;
  const bannedCount = users.filter(u => isBanned(u)).length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 8 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AdminPanelSettingsIcon sx={{ fontSize: 28, color: 'error.main', display: 'block' }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Admin Panel</Typography>
            <Typography variant="body2" color="text.secondary">Godmode — handle with care</Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh user list">
          <IconButton onClick={fetchUsers} disabled={loading} sx={{ color: 'text.secondary' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: users.length, color: 'primary.main' },
          { label: 'Real', value: users.filter(u => !u.is_demo).length, color: 'success.main' },
          { label: 'Demo', value: demoCount, color: 'warning.main' },
          { label: 'Banned', value: bannedCount, color: 'error.main' },
        ].map(s => (
          <Card key={s.label} sx={{ flex: '1 1 100px', minWidth: 100 }}>
            <CardContent sx={{ textAlign: 'center', py: '14px !important' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Demo user management */}
      <Card sx={{ mb: 3, bgcolor: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, py: '14px !important' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Demo Users</Typography>
            <Typography variant="caption" color="text.secondary">
              {demoCount > 0 ? `${demoCount} demo accounts active` : 'No demo accounts — feed will be empty for new users'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<PersonRemoveIcon />}
              disabled={acting || demoCount === 0}
              onClick={() => setConfirm({ type: 'delete-demo' })}
              sx={{ borderRadius: 2 }}
            >
              Delete all demo
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={seedingDemo ? <CircularProgress size={14} color="inherit" /> : <PersonAddIcon />}
              disabled={seedingDemo}
              onClick={handleSeedDemo}
              sx={{ borderRadius: 2 }}
            >
              Seed demo users
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3 }} />

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
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(u => (
                <TableRow
                  key={u.id}
                  sx={{
                    opacity: u.is_demo ? 0.65 : 1,
                    bgcolor: isBanned(u) ? 'rgba(239,68,68,0.04)' : undefined,
                    '&:last-child td': { border: 0 },
                    '&:hover': { bgcolor: isBanned(u) ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', opacity: isBanned(u) ? 0.5 : 1 }}>
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
                      {isBanned(u) && (
                        <Chip label="banned" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.15)', color: 'error.main', border: '1px solid rgba(239,68,68,0.3)' }} />
                      )}
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
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        {isBanned(u) ? (
                          <Tooltip title="Unban user">
                            <IconButton size="small" onClick={() => handleUnbanUser(u.id)} sx={{ color: 'success.main', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                              <LockOpenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Ban user (block login)">
                            <IconButton size="small" onClick={() => setConfirm({ type: 'ban', user: u })} sx={{ color: 'warning.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete permanently">
                          <IconButton size="small" onClick={() => setConfirm({ type: 'delete', user: u })} sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
                    No users match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Confirm dialog */}
      <Dialog
        open={!!confirm}
        onClose={() => !acting && setConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        {confirm?.type === 'delete' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete user?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Permanently delete <strong>{confirm.user.name || confirm.user.email}</strong>?
                Removes their account, profile, goals, and all data.{' '}
                <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Cannot be undone.</Box>
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleDeleteUser(confirm.user.id)}>
                Delete permanently
              </Button>
            </DialogActions>
          </>
        )}
        {confirm?.type === 'ban' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Ban user?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Ban <strong>{confirm.user.name || confirm.user.email}</strong>?
                They will be immediately signed out and unable to log back in.
                You can unban them at any time.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="warning" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleBanUser(confirm.user.id)}>
                Ban user
              </Button>
            </DialogActions>
          </>
        )}
        {confirm?.type === 'delete-demo' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete all demo users?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                This will permanently delete all <strong>{demoCount} demo accounts</strong> and their data.
                The match feed will appear empty until you re-seed them.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={handleDeleteAllDemo}>
                Delete all demo
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminPage;
