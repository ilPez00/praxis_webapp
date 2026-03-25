import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import CallIcon from '@mui/icons-material/Call';

interface IncomingCallDialogProps {
  open: boolean;
  callerName: string;
  onAccept: () => void;
  onDecline: () => void;
}

const IncomingCallDialog: React.FC<IncomingCallDialogProps> = ({
  open,
  callerName,
  onAccept,
  onDecline,
}) => {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, textAlign: 'center' }}>
        <CallIcon sx={{ color: 'primary.main', mr: 1, verticalAlign: 'middle' }} />
        Incoming Video Call
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center' }}>
        <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 1.5, fontSize: '1.5rem' }}>
          {callerName.charAt(0)}
        </Avatar>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>{callerName}</Typography>
        <Typography variant="body2" color="text.secondary">is calling you…</Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
        <Button
          variant="outlined"
          color="error"
          onClick={onDecline}
          sx={{ borderRadius: 3, px: 3 }}
        >
          Decline
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={onAccept}
          sx={{ borderRadius: 3, px: 3 }}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IncomingCallDialog;
