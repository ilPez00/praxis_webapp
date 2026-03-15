import React, { useState } from 'react';
import {
  Box, Typography, SwipeableDrawer, Slider, useTheme, useMediaQuery,
} from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../../trackers/trackerTypes';

export interface ActionItem {
  key: string;
  icon: string;
  label: string;
}

interface GoalWorkspaceSheetProps {
  node: GoalNode | null;
  allNodes: any[];
  open: boolean;
  onClose: () => void;
  onProgressChange: (nodeId: string, progress: number) => void;
  onNodeSelect: (node: GoalNode) => void;
  onAddSubgoal: (parentId: string) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  onAction: (action: string, node: GoalNode) => void;
  userId: string;
  readOnly?: boolean;
  actions?: ActionItem[];
  children?: React.ReactNode;
}

function getNodeDomain(nodeId: string, allNodes: any[]): string {
  const node = allNodes.find((n: any) => n.id === nodeId);
  if (!node) return 'Personal Goals';
  if (node.domain) return node.domain;
  if (!node.parentId) return 'Personal Goals';
  return getNodeDomain(node.parentId, allNodes);
}

const GoalWorkspaceSheet: React.FC<GoalWorkspaceSheetProps> = ({
  node, allNodes, open, onClose, onProgressChange, onNodeSelect,
  onAddSubgoal, onLogTracker, onAction, userId, readOnly, actions, children,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [localProgress, setLocalProgress] = useState<number | null>(null);

  if (!node) return null;

  const domain = getNodeDomain(node.id, allNodes);
  const domainColor = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];
  const domainIcon = DOMAIN_ICONS[domain] || '🎯';

  const trackerTypeId = (DOMAIN_TRACKER_MAP as Record<string, string[]>)[domain]?.[0] ?? 'progress';
  const trackerType = TRACKER_TYPES.find(t => t.id === trackerTypeId);

  const progress = localProgress ?? node.progress;

  const content = (
    <Box sx={{ p: 2.5 }}>
      {isMobile && (
        <Box sx={{ textAlign: 'center', mb: 1.5 }}>
          <Box sx={{ width: 32, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto' }} />
        </Box>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: domainColor, letterSpacing: '0.05em' }}>
            {domainIcon} {domain.toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, mt: 0.25 }}>
            {node.title}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#A78BFA' }}>
          {progress}%
        </Typography>
      </Box>

      {/* Progress slider */}
      {!readOnly && (
        <Box sx={{ mb: 2 }}>
          <Slider
            value={progress}
            onChange={(_, v) => setLocalProgress(v as number)}
            onChangeCommitted={(_, v) => {
              onProgressChange(node.id, v as number);
              setLocalProgress(null);
            }}
            min={0} max={100} step={5}
            sx={{
              color: '#A78BFA',
              height: 8,
              '& .MuiSlider-thumb': {
                width: 18, height: 18, bgcolor: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              },
              '& .MuiSlider-track': {
                background: 'linear-gradient(90deg, #F59E0B, #8B5CF6)',
                border: 'none',
              },
              '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.65rem', opacity: 0.3 }}>0%</Typography>
            <Typography sx={{ fontSize: '0.65rem', opacity: 0.3 }}>100%</Typography>
          </Box>
        </Box>
      )}

      {/* Smart tracker button */}
      {!readOnly && trackerType && (
        <Box
          onClick={() => onLogTracker(trackerType.id, node)}
          sx={{
            p: 1.75, borderRadius: '14px', mb: 2, cursor: 'pointer',
            background: `linear-gradient(135deg, ${trackerType.bg}, transparent)`,
            border: `1px solid ${trackerType.border}`,
            display: 'flex', alignItems: 'center', gap: 1.5,
            '&:hover': { borderColor: trackerType.color },
          }}
        >
          <Box sx={{
            width: 40, height: 40, borderRadius: '12px',
            bgcolor: trackerType.bg, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
          }}>
            {trackerType.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.875rem' }}>
              {trackerType.label.replace(' Tracker', '')}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
              Tap to log entry
            </Typography>
          </Box>
          <Typography sx={{ color: trackerType.color, fontSize: '1.25rem', fontWeight: 700 }}>+</Typography>
        </Box>
      )}

      {/* Sub-goals list */}
      {node.children.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{
            fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.08em', mb: 0.75,
          }}>
            SUB-GOALS
          </Typography>
          {node.children.map(child => (
            <Box
              key={child.id}
              onClick={() => onNodeSelect(child)}
              sx={{
                p: '8px 10px', borderRadius: '8px', mb: 0.5, cursor: 'pointer',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 1,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              <Box sx={{
                width: 14, height: 14, borderRadius: '4px',
                border: `2px solid ${child.progress >= 100 ? '#10B981' : 'rgba(255,255,255,0.2)'}`,
                bgcolor: child.progress >= 100 ? 'rgba(16,185,129,0.2)' : 'transparent',
              }} />
              <Typography sx={{ fontSize: '0.85rem', flex: 1 }}>{child.title}</Typography>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.4 }}>{child.progress}%</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Add sub-goal */}
      {!readOnly && (
        <Box
          onClick={() => onAddSubgoal(node.id)}
          sx={{
            p: '6px 10px', fontSize: '0.8rem', color: '#A78BFA',
            display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
            mb: 2,
            '&:hover': { color: '#C4B5FD' },
          }}
        >
          <Typography sx={{ fontSize: '1rem' }}>+</Typography>
          <Typography sx={{ fontSize: '0.8rem' }}>Add sub-goal</Typography>
        </Box>
      )}

      {/* Action icon row */}
      {!readOnly && (
        <Box sx={{
          display: 'flex', justifyContent: 'space-around',
          pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          {(actions || [
            { key: 'journal', icon: '📓', label: 'Journal' },
            { key: 'bet', icon: '🎰', label: 'Bet' },
            { key: 'verify', icon: '✅', label: 'Verify' },
            { key: 'suspend', icon: '⏸', label: 'Suspend' },
            { key: 'edit', icon: '✏️', label: 'Edit' },
          ]).map(action => (
            <Box
              key={action.key}
              onClick={() => onAction(action.key, node)}
              sx={{
                textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                '&:hover': { color: 'rgba(255,255,255,0.8)' },
              }}
            >
              <Typography sx={{ fontSize: '1.1rem', mb: 0.25 }}>{action.icon}</Typography>
              <Typography sx={{ fontSize: '0.65rem' }}>{action.label}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Embedded children (e.g. NoteGoalDetail with tracker widgets) */}
      {children && (
        <Box sx={{ mt: 2 }}>
          {children}
        </Box>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        PaperProps={{
          sx: {
            height: '92vh',
            borderRadius: '16px 16px 0 0',
            background: 'rgba(15,15,25,0.98)',
            border: '1px solid rgba(139,92,246,0.15)',
            borderBottom: 'none',
            overflowY: 'auto',
          },
        }}
      >
        {content}
      </SwipeableDrawer>
    );
  }

  return (
    <Box sx={{
      overflowY: 'auto', height: '100%',
      background: 'rgba(15,15,25,0.98)',
    }}>
      {content}
    </Box>
  );
};

export default GoalWorkspaceSheet;
