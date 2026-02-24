import React from 'react';
import { GoalNode } from '../../../models/GoalNode';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Chip,
  Stack,
  useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { Domain } from '../../../models/Domain';
import { DOMAIN_COLORS } from '../../../types/goal';

interface GoalNodeDisplayProps {
  node: GoalNode;
  onEdit: (node: GoalNode) => void;
  onAddSubGoal: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  isCollapsed: boolean;
  onToggle: (nodeId: string) => void;
  hasChildren: boolean;
}

const GoalNodeDisplay: React.FC<GoalNodeDisplayProps> = ({
  node,
  onEdit,
  onAddSubGoal,
  onDelete,
  isCollapsed,
  onToggle,
  hasChildren,
}) => {
  const theme = useTheme();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        my: 1,
        borderLeft: '5px solid',
        borderLeftColor: DOMAIN_COLORS[node.domain] || theme.palette.primary.main,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" alignItems="center">
            {hasChildren && (
                <IconButton size="small" onClick={() => onToggle(node.id)}>
                    {isCollapsed ? <ArrowRightIcon /> : <ArrowDropDownIcon />}
                </IconButton>
            )}
            <Typography variant="h6" component="h4" sx={{ color: 'primary.main', flexGrow: 1 }}>
            {node.name}
            </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Chip
            label={node.domain}
            size="small"
            sx={{
              backgroundColor: `${DOMAIN_COLORS[node.domain]}15`,
              color: DOMAIN_COLORS[node.domain],
              fontWeight: 'bold',
            }}
          />
          {node.category && (
            <Chip
              label={node.category}
              size="small"
              variant="outlined"
              sx={{ borderColor: theme.palette.divider }}
            />
          )}
        </Stack>
      </Box>

      {node.customDetails && (
        <Typography variant="body2" color="text.secondary">
          {node.customDetails}
        </Typography>
      )}

      <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center">
        <Typography variant="body2" color="text.secondary">
          Progress: {Math.round(node.progress * 100)}%
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Weight: {node.weight.toFixed(2)}
        </Typography>
        <IconButton size="small" onClick={() => onEdit(node)} color="primary">
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => onAddSubGoal(node.id)} color="primary">
          <AddIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(node.id)} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

export default GoalNodeDisplay;
