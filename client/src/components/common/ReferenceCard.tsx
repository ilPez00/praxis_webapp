import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import FlagIcon from '@mui/icons-material/Flag';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import EventIcon from '@mui/icons-material/Event';
import CloseIcon from '@mui/icons-material/Close';

import PlaceIcon from '@mui/icons-material/Place';

export interface Reference {
  type: 'goal' | 'service' | 'post' | 'group' | 'event' | 'place';
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
}

const TYPE_META: Record<Reference['type'], { color: string; icon: React.ReactNode; label: string }> = {
  goal:    { color: '#10B981', icon: <FlagIcon sx={{ fontSize: 14 }} />,            label: 'Goal'    },
  service: { color: '#F59E0B', icon: <WorkOutlineIcon sx={{ fontSize: 14 }} />,     label: 'Service' },
  post:    { color: '#3B82F6', icon: <ArticleOutlinedIcon sx={{ fontSize: 14 }} />, label: 'Post'    },
  group:   { color: '#8B5CF6', icon: <GroupsIcon sx={{ fontSize: 14 }} />,          label: 'Group'   },
  event:   { color: '#EC4899', icon: <EventIcon sx={{ fontSize: 14 }} />,           label: 'Event'   },
  place:   { color: '#6366F1', icon: <PlaceIcon sx={{ fontSize: 14 }} />,           label: 'Place'   },
};

interface Props {
  reference: Reference;
  onRemove?: () => void; // show X button when provided
  compact?: boolean;     // smaller padding for chat messages
}

const ReferenceCard: React.FC<Props> = ({ reference, onRemove, compact = false }) => {
  const navigate = useNavigate();
  const meta = TYPE_META[reference.type];

  const handleClick = () => {
    if (reference.url && !onRemove) navigate(reference.url);
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: compact ? 1 : 1.5,
        py: compact ? 0.5 : 0.75,
        borderRadius: '8px',
        border: `1px solid ${meta.color}33`,
        borderLeft: `3px solid ${meta.color}`,
        bgcolor: `${meta.color}0d`,
        cursor: reference.url && !onRemove ? 'pointer' : 'default',
        '&:hover': reference.url && !onRemove ? { bgcolor: `${meta.color}1a` } : {},
        minWidth: 0,
      }}
    >
      <Box sx={{ color: meta.color, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {meta.icon}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ color: meta.color, fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          {meta.label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, fontSize: compact ? '0.78rem' : '0.85rem', lineHeight: 1.2 }}
          noWrap
        >
          {reference.title}
        </Typography>
        {reference.subtitle && (
          <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block', fontSize: '0.7rem' }}>
            {reference.subtitle}
          </Typography>
        )}
      </Box>
      {onRemove && (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' }, flexShrink: 0 }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  );
};

export default ReferenceCard;
