import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Box,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface Props {
  onPostClick: () => void;
}

const QuickActionFAB: React.FC<Props> = ({ onPostClick }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: <EditIcon />, name: 'New Post', onClick: onPostClick },
    { icon: <AddCircleOutlineIcon />, name: 'Add Goal', onClick: () => navigate('/goals') },
    { icon: <AutoAwesomeIcon />, name: 'Ask Axiom', onClick: () => navigate('/coaching') },
  ];

  return (
    <Box sx={{ position: 'fixed', bottom: { xs: 80, sm: 32 }, right: { xs: 16, sm: 32 }, zIndex: 1000 }}>
      <SpeedDial
        ariaLabel="Quick actions"
        icon={<SpeedDialIcon />}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        FabProps={{
          sx: {
            bgcolor: 'primary.main',
            color: '#0A0B14',
            '&:hover': { bgcolor: 'primary.light' },
            boxShadow: '0 8px 32px rgba(245,158,11,0.4)',
          }
        }}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => {
              setOpen(false);
              action.onClick();
            }}
            FabProps={{
              sx: {
                bgcolor: 'background.paper',
                color: 'primary.main',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
              }
            }}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};

export default QuickActionFAB;
