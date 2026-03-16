import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
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
import GroupsIcon from '@mui/icons-material/Groups';
import toast from 'react-hot-toast';
import { AdminGroup, ConfirmAction, apiFetch, downloadCSV } from './adminTypes';

interface GroupsTabProps {
  groups: AdminGroup[];
  loadingGroups: boolean;
  fetchGroups: () => Promise<void>;
}

const GroupsTab: React.FC<GroupsTabProps> = ({ groups, loadingGroups, fetchGroups }) => {
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [acting, setActing] = useState(false);

  const handleDeleteGroup = async (groupId: string) => {
    setActing(true);
    try {
      const res = await apiFetch(`/admin/groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) { await fetchGroups(); toast.success('Group deleted.'); }
      else toast.error('Failed to delete group.');
    } catch { toast.error('Failed.'); } finally { setActing(false); setConfirm(null); }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Groups & Boards</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadCSV(groups as unknown as Record<string, unknown>[], 'praxis-groups.csv')}
            disabled={groups.length === 0}
            sx={{ borderRadius: 2 }}
          >
            Download CSV
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchGroups} disabled={loadingGroups} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loadingGroups ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : groups.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <GroupsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">No groups or boards yet.</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map(g => (
                <TableRow key={g.id} sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{g.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={g.is_board ? 'board' : 'chat'}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.65rem',
                        bgcolor: g.is_board ? 'rgba(99,102,241,0.12)' : 'rgba(34,197,94,0.1)',
                        color: g.is_board ? '#818CF8' : '#4ADE80',
                        border: `1px solid ${g.is_board ? 'rgba(99,102,241,0.3)' : 'rgba(34,197,94,0.25)'}`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.disabled">{new Date(g.created_at).toLocaleDateString()}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete group permanently">
                      <IconButton size="small" onClick={() => setConfirm({ type: 'delete-group', group: g })}
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

      {/* Delete group confirm dialog */}
      <Dialog open={confirm?.type === 'delete-group'} onClose={() => !acting && setConfirm(null)} maxWidth="xs" fullWidth>
        {confirm?.type === 'delete-group' && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete {confirm.group.is_board ? 'board' : 'group'}?</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                Permanently delete <strong>{confirm.group.name}</strong>?
                All messages and posts in this {confirm.group.is_board ? 'board' : 'group'} will be removed.{' '}
                <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Cannot be undone.</Box>
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setConfirm(null)} disabled={acting}>Cancel</Button>
              <Button variant="contained" color="error" disabled={acting}
                endIcon={acting ? <CircularProgress size={14} color="inherit" /> : null}
                onClick={() => handleDeleteGroup(confirm.group.id)}>
                Delete permanently
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default GroupsTab;
