import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';

interface Props {
  /** The goal node IDs that this user has opened for sparring challenges */
  openNodeIds?: string[];
  /** If true, show a compact icon-only badge */
  compact?: boolean;
}

/**
 * SparringBadge — indicates that a user is open to sparring challenges
 * on at least one of their goal nodes.
 */
const SparringBadge: React.FC<Props> = ({ openNodeIds, compact = false }) => {
  if (!openNodeIds || openNodeIds.length === 0) return null;

  return (
    <Tooltip title={`Open to sparring on ${openNodeIds.length} goal${openNodeIds.length > 1 ? 's' : ''}`} placement="top">
      <Chip
        icon={<SportsKabaddiIcon sx={{ fontSize: compact ? '14px !important' : '16px !important' }} />}
        label={compact ? undefined : 'Sparring'}
        size="small"
        sx={{
          bgcolor: 'rgba(239,68,68,0.1)',
          color: '#EF4444',
          border: '1px solid rgba(239,68,68,0.3)',
          fontWeight: 700,
          fontSize: compact ? undefined : '0.65rem',
          height: compact ? 22 : 24,
          minWidth: compact ? 28 : undefined,
          '& .MuiChip-label': compact ? { px: 0 } : {},
          cursor: 'default',
        }}
      />
    </Tooltip>
  );
};

export default SparringBadge;
