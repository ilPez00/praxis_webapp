import React, { useState, useCallback, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Box, Typography, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Chip, Avatar, TextField, InputAdornment,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Divider,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BlockIcon from '@mui/icons-material/Block';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ShieldIcon from '@mui/icons-material/Shield';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import SearchIcon from '@mui/icons-material/Search';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import RefreshIcon from '@mui/icons-material/Refresh';
import StarsIcon from '@mui/icons-material/Stars';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditTreeIcon from '@mui/icons-material/AccountTree';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import toast from 'react-hot-toast';
import { AdminUser, UserDetail, ConfirmAction, apiFetch, downloadCSV, isBanned } from './adminTypes';

interface UsersTabProps {
  currentUserId?: string;
  users: AdminUser[];
  setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>;
  loadingUsers: boolean;
  fetchUsers: () => Promise<void>;
}

const UsersTab: React.FC<UsersTabProps> = ({ currentUserId, users, setUsers, loadingUsers, fetchUsers }) => {
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [acting, setActing] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [ppAmounts, setPpAmounts] = useState<Record<string, string>>({});
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── User actions ─────────────────────────────────────────────────────────────

  const handleResetUser = async (userId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/users/${userId}?reset_only=true`, { method: 'DELETE' });
      if (res.ok) { 
        toast.success('User reset. They must complete onboarding again.'); 
        setUsers(prev => prev.map(u => u.id === userId ? { 
          ...u, 
          onboarding_completed: false,
          bio: null,
          avatar_url: null,
        } : u));
      }
      else { const b = await res.json().catch(() => ({})); toast.error((b as any).message || 'Failed.'); }
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  const handleDeleteUser = async (userId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/users/${userId}?hard_delete=true`, { method: 'DELETE' });
      if (res.ok) { setUsers(prev => prev.filter(u => u.id !== userId)); toast.success('User deleted permanently.'); }
      else { const b = await res.json().catch(() => ({})); toast.error((b as any).message || 'Failed.'); }
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  const handleBanUser = async (userId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/users/${userId}/ban`, { method: 'POST' });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned_until: new Date(Date.now() + 876000 * 3600 * 1000).toISOString() } : u));
        toast.success('User banned.');
      } else toast.error('Failed to ban user.');
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/unban`, { method: 'POST' });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned_until: null } : u));
        toast.success('User unbanned.');
      }
    } catch { toast.error('Failed.'); }
  };

  const handlePromoteUser = async (userId: string, role: string) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role, is_admin: role === 'admin' } : u));
        toast.success(`User set to ${role}.`);
      } else {
        const b = await res.json().catch(() => ({}));
        toast.error((b as any).message || 'Failed to update role.');
      }
    } catch { toast.error('Failed.'); }
  };

  const handleTogglePremium = async (userId: string, current: boolean) => {
    try {
      const is_premium = !current;
      const res = await apiFetch(`/admin/users/${userId}/premium`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_premium }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_premium } : u));
        toast.success(is_premium ? 'User granted Pro status.' : 'Pro status revoked.');
      } else {
        const b = await res.json().catch(() => ({}));
        toast.error((b as any).message || 'Failed to update premium status.');
      }
    } catch { toast.error('Failed.'); }
  };

  const handleModifyPoints = async (userId: string, sign: 1 | -1) => {
    const raw = ppAmounts[userId] || '100';
    const amount = parseInt(raw, 10);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid positive amount.'); return; }
    const delta = sign * amount;
    try {
      const res = await apiFetch(`/admin/users/${userId}/grant-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (res.ok) {
        const body = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, praxis_points: body.points } : u));
        toast.success(`PP: ${body.points.toLocaleString()} (${delta > 0 ? '+' : ''}${delta})`);
      } else toast.error('Failed to update points.');
    } catch { toast.error('Failed.'); }
  };

  const handleResetTreeEdits = async (userId: string) => {
    try {
      const res = await apiFetch(`/admin/users/${userId}/reset-tree-edits`, { method: 'POST' });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, goal_tree_edit_count: 0 } : u));
        toast.success('Goal tree edit reset — user gets 1 free edit.');
      } else toast.error('Failed.');
    } catch { toast.error('Failed.'); }
  };

  const handleOpenDetail = async (userId: string) => {
    setLoadingDetail(true);
    setUserDetail(null);
    try {
      const res = await apiFetch(`/admin/users/${userId}/detail`);
      if (res.ok) setUserDetail(await res.json());
      else toast.error('Failed to load user detail.');
    } catch { toast.error('Failed.'); } finally { setLoadingDetail(false); }
  };

  const handleDeleteAllDemo = async () => {
    setActing(true);
    try {
      const res = await apiFetch('/admin/demo-users', { method: 'DELETE' });
      if (res.ok) {
        const body = await res.json();
        setUsers(prev => prev.filter(u => !u.is_demo));
        toast.success(body.message || 'Demo users deleted.');
      }
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      const res = await apiFetch('/admin/seed', { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        toast.success(body.message || 'Demo users seeded.');
        fetchUsers();
      }
    } catch { toast.error('Failed.'); } finally { setSeedingDemo(false); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────────

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const demoCount = users.filter(u => u.is_demo).length;

  return (
    <>
      {/* Demo management */}
      <Card sx={{ mb: 3, bgcolor: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, py: '14px !important' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Demo Users</Typography>
            <Typography variant="caption" color="text.secondary">
              {demoCount > 0 ? `${demoCount} demo accounts active` : 'No demo accounts — feed will be empty for new users'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" color="error" startIcon={<PersonRemoveIcon />}
              disabled={acting || demoCount === 0} onClick={() => setConfirm({ type: 'delete-demo' })} sx={{ borderRadius: 2 }}>
              Delete all demo
            </Button>
            <Button size="small" variant="outlined" color="warning"
              startIcon={seedingDemo ? <CircularProgress size={14} color="inherit" /> : <PersonAddIcon />}
              disabled={seedingDemo} onClick={handleSeedDemo} sx={{ borderRadius: 2 }}>
              Seed demo users
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Quick stats chips */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: users.length, color: 'primary.main' },
          { label: 'Real', value: users.filter(u => !u.is_demo).length, color: 'success.main' },
          { label: 'Demo', value: demoCount, color: 'warning.main' },
          { label: 'Banned', value: users.filter(u => isBanned(u)).length, color: 'error.main' },
        ].map(s => (
          <Card key={s.label} sx={{ flex: '1 1 80px', minWidth: 80 }}>
            <CardContent sx={{ textAlign: 'center', py: '12px !important' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
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
          sx={{ width: 320 }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadCSV(users as unknown as Record<string, unknown>[], 'praxis-users.csv')}
            disabled={users.length === 0}
            sx={{ borderRadius: 2 }}
          >
            Download CSV
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchUsers} disabled={loadingUsers} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loadingUsers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell>PP / Streak</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id} sx={{
                  opacity: u.is_demo ? 0.65 : 1,
                  bgcolor: isBanned(u) ? 'rgba(239,68,68,0.04)' : undefined,
                  '&:last-child td': { border: 0 },
                  '&:hover': { bgcolor: isBanned(u) ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)' },
                }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', opacity: isBanned(u) ? 0.5 : 1 }}>
                        {(u.name || u.email || '?')[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{u.name || '—'}</Typography>
                        {u.id === currentUserId && <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>you</Typography>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{u.email || '—'}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {isBanned(u) && <Chip label="banned" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.15)', color: 'error.main', border: '1px solid rgba(239,68,68,0.3)' }} />}
                      {u.is_demo && <Chip label="demo" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245,158,11,0.12)', color: 'warning.main', border: '1px solid rgba(245,158,11,0.25)' }} />}
                      {u.is_admin && <Chip label="admin" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.12)', color: 'error.main', border: '1px solid rgba(239,68,68,0.25)' }} />}
                      {!u.is_admin && u.role === 'moderator' && <Chip label="mod" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }} />}
                      {!u.is_admin && u.role === 'staff' && <Chip label="staff" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }} />}
                      {u.is_premium && <Chip label="pro" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(139,92,246,0.12)', color: 'secondary.main', border: '1px solid rgba(139,92,246,0.25)' }} />}
                      {(u.honor_score ?? 0) > 0 && <Chip label={`⭐ ${u.honor_score}`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }} />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>
                      ⚡{(u.praxis_points ?? 0).toLocaleString()}
                    </Typography>
                    {(u.current_streak ?? 0) > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        🔥{u.current_streak}d
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><Typography variant="caption" color="text.disabled">{new Date(u.created_at).toLocaleDateString()}</Typography></TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* PP modifier */}
                      <TextField
                        size="small"
                        type="number"
                        value={ppAmounts[u.id] ?? '100'}
                        onChange={e => setPpAmounts(prev => ({ ...prev, [u.id]: e.target.value }))}
                        inputProps={{ min: 1, style: { width: 52, padding: '2px 4px', fontSize: '0.72rem' } }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1, height: 24 } }}
                      />
                      <Tooltip title="Add PP">
                        <IconButton size="small" onClick={() => handleModifyPoints(u.id, 1)} sx={{ color: '#A78BFA', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                          <AddCircleOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove PP">
                        <IconButton size="small" onClick={() => handleModifyPoints(u.id, -1)} sx={{ color: 'warning.main', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                          <RemoveCircleOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={`Reset free goal-tree edit (currently ${u.goal_tree_edit_count ?? 0} edits used)`}>
                        <IconButton size="small" onClick={() => handleResetTreeEdits(u.id)} sx={{ color: '#10B981', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                          <EditTreeIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View all user metrics">
                        <IconButton size="small" onClick={() => handleOpenDetail(u.id)} sx={{ color: 'text.secondary', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      {u.id !== currentUserId && (
                        <>
                          <Tooltip title={u.role === 'staff' ? 'Demote to user' : 'Make staff'}>
                            <IconButton size="small" onClick={() => handlePromoteUser(u.id, u.role === 'staff' ? 'user' : 'staff')} sx={{ color: '#10B981', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                              <ShieldIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={u.role === 'moderator' || u.is_admin ? 'Demote to user' : 'Make moderator'}>
                            <IconButton size="small" onClick={() => handlePromoteUser(u.id, (u.role === 'moderator' || u.is_admin) ? 'user' : 'moderator')} sx={{ color: '#3B82F6', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                              <WorkspacePremiumIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={u.is_premium ? 'Revoke Pro' : 'Grant Pro'}>
                            <IconButton size="small" onClick={() => handleTogglePremium(u.id, !!u.is_premium)} sx={{ color: u.is_premium ? 'secondary.main' : 'text.disabled', opacity: u.is_premium ? 1 : 0.6, '&:hover': { opacity: 1 } }}>
                              <StarsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {isBanned(u) ? (
                            <Tooltip title="Unban user">
                              <IconButton size="small" onClick={() => handleUnbanUser(u.id)} sx={{ color: 'success.main', opacity: 0.7, '&:hover': { opacity: 1 } }}>
                                <LockOpenIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Ban user">
                              <IconButton size="small" onClick={() => setConfirm({ type: 'ban', user: u })} sx={{ color: 'warning.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Reset to onboarding">
                            <IconButton size="small" onClick={() => setConfirm({ type: 'reset', user: u })} sx={{ color: 'info.main', opacity: 0.6, '&:hover': { opacity: 1 } }}>
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete permanently">
                            <IconButton size="small" onClick={() => setConfirm({ type: 'delete', user: u })} sx={{ color: 'error.main', opacity: 0.5, '&:hover': { opacity: 1 } }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
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

      {/* ── Confirm dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!confirm} onClose={() => !acting && setConfirm(null)} maxWidth="xs" fullWidth>
        {confirm?.type === 'reset' && (
          <>
            <DialogTitle sx={{ fontWeight: 700, color: 'info.main' }}>Reset user to onboarding?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Reset <strong>{confirm.user.name || confirm.user.email}</strong> to pre-onboarding state?
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(59,130,246,0.08)', borderRadius: 2, border: '1px solid rgba(59,130,246,0.2)' }}>
                <Typography variant="caption" sx={{ color: '#3B82F6', fontWeight: 700, display: 'block', mb: 1 }}>
                  This will:
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  ✓ Delete all their data (goals, posts, trackers, messages, etc.)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  ✓ Reset their profile (bio, avatar, stats, premium status)
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  ✓ Keep their account (email/password) intact
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700 }}>
                  → They will need to complete onboarding again on next login
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="info" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleResetUser(confirm.user.id)}>
                Reset User
              </Button>
            </DialogActions>
          </>
        )}
        {confirm?.type === 'delete' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete user?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Permanently delete <strong>{confirm.user.name || confirm.user.email}</strong>?
                Removes their account and all data.{' '}
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
                Ban <strong>{confirm.user.name || confirm.user.email}</strong>? They will be immediately signed out.
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

      {/* ── User Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!userDetail || loadingDetail} onClose={() => setUserDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoOutlinedIcon sx={{ color: 'primary.main' }} />
          User Metrics
        </DialogTitle>
        <DialogContent>
          {loadingDetail && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
          {userDetail && (() => {
            const d = userDetail;
            const rows: { label: string; value: string | number | boolean | null | undefined }[] = [
              { label: 'ID', value: d.id },
              { label: 'Name', value: d.name || '—' },
              { label: 'Email', value: d.email || '—' },
              { label: 'Username', value: d.username || '—' },
              { label: 'City', value: d.city || '—' },
              { label: 'Bio', value: d.bio || '—' },
              { label: 'Role', value: d.role || 'user' },
              { label: 'Premium', value: d.is_premium ? 'Yes' : 'No' },
              { label: 'Admin', value: d.is_admin ? 'Yes' : 'No' },
              { label: 'Demo', value: d.is_demo ? 'Yes' : 'No' },
              { label: 'Onboarding complete', value: d.onboarding_completed ? 'Yes' : 'No' },
              { label: 'Praxis Points (PP)', value: (d.praxis_points ?? 0).toLocaleString() },
              { label: 'Current Streak', value: `${d.current_streak ?? 0} days` },
              { label: 'Reliability Score', value: d.reliability_score != null ? d.reliability_score.toFixed(2) : '—' },
              { label: 'Honor Score', value: d.honor_score ?? 0 },
              { label: 'Goal Tree Edits Used', value: d.goal_tree_edit_count ?? 0 },
              { label: 'Root Goals', value: d.root_goal_count },
              { label: 'Total Goal Nodes', value: d.total_node_count },
              { label: 'Total Check-ins', value: d.checkin_count },
              { label: 'Total Posts', value: d.post_count },
              { label: 'Friends', value: d.friend_count },
              { label: 'Verifications Given', value: d.verification_count },
              { label: 'Joined', value: new Date(d.created_at).toLocaleString() },
            ];
            return (
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {rows.map(r => (
                    <Box
                      component="tr"
                      key={r.label}
                      sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                    >
                      <Box component="td" sx={{ py: 0.75, px: 1.5, color: 'text.secondary', fontSize: '0.78rem', fontWeight: 600, width: '45%', verticalAlign: 'top' }}>
                        {r.label}
                      </Box>
                      <Box component="td" sx={{ py: 0.75, px: 1.5, fontSize: '0.78rem', wordBreak: 'break-all', verticalAlign: 'top' }}>
                        {String(r.value ?? '—')}
                      </Box>
                    </Box>
                  ))}
                </tbody>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUserDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UsersTab;
