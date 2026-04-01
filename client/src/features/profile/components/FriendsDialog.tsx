import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import ReferralWidget from '../../referral/ReferralWidget';
import {
  Avatar,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

interface FriendsDialogProps {
  open: boolean;
  onClose: () => void;
  isOwnProfile: boolean;
  profileName: string;
  targetUserId?: string;
  currentUserId?: string;
}

const FriendsDialog: React.FC<FriendsDialogProps> = ({
  open,
  onClose,
  isOwnProfile,
  profileName,
  targetUserId,
  currentUserId,
}) => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    if (!open || loaded || !targetUserId) return;
    setLoading(true);
    api.get(`/friends/of/${targetUserId}`)
      .then(r => setFriends(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Could not load friends.'))
      .finally(() => { setLoading(false); setLoaded(true); });
  }, [open, loaded, targetUserId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        {isOwnProfile ? 'Your Friends' : `${profileName}'s Friends`}
      </DialogTitle>
      <DialogContent sx={{ px: 1, pb: 2 }}>
        {isOwnProfile && currentUserId && (
          <Box sx={{ px: 1, mb: 1 }}>
            <ReferralWidget userId={currentUserId} />
          </Box>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : friends.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No friends yet.
          </Typography>
        ) : (
          <List disablePadding>
            {friends.map((f: any) => (
              <ListItem
                key={f.id}
                sx={{ borderRadius: '10px', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }, px: 1.5 }}
                onClick={() => { onClose(); navigate(`/profile/${f.id}`); }}
              >
                <ListItemAvatar>
                  <Avatar src={f.avatar_url ?? undefined} sx={{ width: 40, height: 40 }}>
                    {f.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{f.name}</Typography>}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {f.current_streak > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <LocalFireDepartmentIcon sx={{ fontSize: 13, color: '#F59E0B' }} />
                          <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 600 }}>{f.current_streak}d</Typography>
                        </Box>
                      )}
                      {f.praxis_points > 0 && (
                        <Typography variant="caption" color="text.disabled">{f.praxis_points} PP</Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FriendsDialog;
