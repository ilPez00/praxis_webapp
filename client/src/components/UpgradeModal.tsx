import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const PRO_FEATURES = [
  'Unlimited goal tree edits',
  'Master Roshi AI coaching',
  'Advanced analytics & insights',
  'Unlimited match connections',
  'Priority profile visibility',
];

interface Props {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

const UpgradeModal: React.FC<Props> = ({ open, onClose, featureName }) => {
  const navigate = useNavigate();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #0F1117 0%, #1A1D2E 100%)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '20px',
          p: 1,
        },
      }}
    >
      <DialogContent>
        <Box sx={{ textAlign: 'center', mb: 3, pt: 1 }}>
          <Box sx={{ fontSize: '2.5rem', mb: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', mb: 0.5 }}>
            Upgrade to Pro
          </Typography>
          {featureName && (
            <Typography variant="body2" color="text.secondary">
              <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{featureName}</Box>
              {' '}requires a Pro subscription.
            </Typography>
          )}
        </Box>

        <List dense sx={{ mb: 2 }}>
          {PRO_FEATURES.map((f) => (
            <ListItem key={f} disableGutters sx={{ py: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary={f}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
              />
            </ListItem>
          ))}
        </List>

        <Stack spacing={1.5}>
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={() => { onClose(); navigate('/upgrade'); }}
            sx={{
              borderRadius: '12px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#0A0B14',
              '&:hover': { background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)' },
            }}
          >
            Upgrade to Pro — $10/mo
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={onClose}
            sx={{ color: 'text.secondary', fontWeight: 600 }}
          >
            Maybe Later
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
