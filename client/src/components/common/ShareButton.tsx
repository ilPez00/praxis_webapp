import React, { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import ShareDialog from './ShareDialog';

interface ShareButtonProps {
  sourceTable: 'posts' | 'places' | 'events' | 'goal_nodes' | 'profiles' | 'messages';
  sourceId: string;
  title?: string;
  content?: string;
  metadata?: any;
  icon?: React.ReactNode;
  tooltip?: string;
  color?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({
  sourceTable,
  sourceId,
  title = 'Shared item',
  content = '',
  metadata = {},
  icon = <ShareIcon fontSize="small" />,
  tooltip = 'Share',
  color,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={tooltip}>
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          sx={color ? { color } : {}}
        >
          {icon}
        </IconButton>
      </Tooltip>
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        sourceTable={sourceTable}
        sourceId={sourceId}
        title={title}
        content={content}
        metadata={metadata}
      />
    </>
  );
};

export default ShareButton;
