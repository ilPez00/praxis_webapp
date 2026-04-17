import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Stack,
  Button,
  Typography,
  Box,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CameraActionSheet: React.FC<Props> = ({ open, onClose }) => {
  const navigate = useNavigate();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Camera</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          What would you like to do?
        </Typography>
        <Stack spacing={1.5}>
          <Button
            variant="outlined"
            size="large"
            startIcon={<VideocamIcon sx={{ color: '#EF4444' }} />}
            onClick={() => go('/go-live')}
            sx={{
              justifyContent: 'flex-start',
              borderRadius: 2,
              py: 1.5,
              px: 2,
              borderColor: 'rgba(239,68,68,0.4)',
              color: 'text.primary',
              '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.06)' },
            }}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 700 }}>Stream Live</Typography>
              <Typography variant="caption" color="text.secondary">
                Broadcast to followers in real time
              </Typography>
            </Box>
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<FiberManualRecordIcon sx={{ color: '#F97316' }} />}
            onClick={() => go('/camera?mode=record')}
            sx={{
              justifyContent: 'flex-start',
              borderRadius: 2,
              py: 1.5,
              px: 2,
              borderColor: 'rgba(249,115,22,0.4)',
              color: 'text.primary',
              '&:hover': { borderColor: '#F97316', bgcolor: 'rgba(249,115,22,0.06)' },
            }}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 700 }}>Record Video</Typography>
              <Typography variant="caption" color="text.secondary">
                Save to your notebook
              </Typography>
            </Box>
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<PhotoCameraIcon sx={{ color: '#A78BFA' }} />}
            onClick={() => go('/camera?mode=photo')}
            sx={{
              justifyContent: 'flex-start',
              borderRadius: 2,
              py: 1.5,
              px: 2,
              borderColor: 'rgba(167,139,250,0.4)',
              color: 'text.primary',
              '&:hover': { borderColor: '#A78BFA', bgcolor: 'rgba(167,139,250,0.06)' },
            }}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography sx={{ fontWeight: 700 }}>Take Picture</Typography>
              <Typography variant="caption" color="text.secondary">
                Save a still moment
              </Typography>
            </Box>
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default CameraActionSheet;
