import React from 'react';
import { GoalNode } from '../models/GoalNode';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Chip,
  Stack,
  useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { Domain } from '../models/Domain'; // Assuming Domain enum is available

interface GoalNodeDisplayProps {
  node: GoalNode;
  onEdit: (node: GoalNode) => void;
  onAddSubGoal: (parentId: string) => void;
  onDelete: (nodeId: string) => void; // Add onDelete prop
}

const DOMAIN_COLORS: Record<Domain, string> = {
  [Domain.CAREER]: '#4CAF50',
  [Domain.INVESTING]: '#26A69A',
  [Domain.FITNESS]: '#E57373',
  [Domain.ACADEMICS]: '#EC407A',
  [Domain.MENTAL_HEALTH]: '#64B5F6',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#78909C',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#9CCC65',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#FFA726',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#AB47BC',
};

const GoalNodeDisplay: React.FC<GoalNodeDisplayProps> = ({ node, onEdit, onAddSubGoal, onDelete }) => {
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
        <Typography variant="h6" component="h4" sx={{ color: 'primary.main', flexGrow: 1 }}>
          {node.name}
        </Typography>
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
        <IconButton size="small" onClick={() => onDelete(node.id)} color="error"> {/* Delete button */}
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

export default GoalNodeDisplay;
