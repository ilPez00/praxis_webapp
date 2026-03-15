import React, { useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../trackers/trackerTypes';

interface NotesCardTreeProps {
  nodes: GoalNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  onAddGoal?: () => void;
  readOnly?: boolean;
}

function groupByDomain(nodes: GoalNode[]): Record<string, GoalNode[]> {
  return nodes.reduce((acc, n) => {
    const domain = n.domain || 'Personal Goals';
    (acc[domain] ??= []).push(n);
    return acc;
  }, {} as Record<string, GoalNode[]>);
}

function domainProgress(goals: GoalNode[]): number {
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
}

/* ─── Branch colors ──────────────────────────────── */
const BRANCH_COLOR = 'rgba(139,92,246,0.18)';
const BRANCH_COLOR_ACTIVE = 'rgba(139,92,246,0.35)';

/* ─── Compact pill node ──────────────────────────── */
const GoalPill: React.FC<{
  node: GoalNode;
  depth: number;
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  domainColor: string;
  isLast: boolean;
}> = ({ node, depth, selectedNodeId, onNodeSelect, onLogTracker, domainColor, isLast }) => {
  const isSelected = node.id === selectedNodeId;
  const isSuspended = node.status === 'suspended';
  const isCompleted = node.progress >= 100;
  const isActive = !isSuspended && !isCompleted;
  const ref = useRef<HTMLDivElement>(null);

  const trackerIds = depth === 0 && isActive
    ? (DOMAIN_TRACKER_MAP as Record<string, string[]>)[node.domain || ''] || []
    : [];
  const trackers = trackerIds
    .map(id => TRACKER_TYPES.find(t => t.id === id))
    .filter(Boolean) as typeof TRACKER_TYPES;

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const hasChildren = node.children.length > 0;

  return (
    <Box sx={{ position: 'relative', pl: depth > 0 ? '22px' : 0 }}>
      {/* Horizontal branch connector (from left trunk to this pill) */}
      {depth > 0 && (
        <Box sx={{
          position: 'absolute',
          left: 0,
          top: '16px',
          width: '18px',
          height: '2px',
          background: isActive ? BRANCH_COLOR_ACTIVE : BRANCH_COLOR,
          borderRadius: '1px',
        }} />
      )}
      {/* Vertical trunk line connecting siblings */}
      {depth > 0 && (
        <Box sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '2px',
          height: isLast ? '17px' : '100%',
          background: isActive ? BRANCH_COLOR_ACTIVE : BRANCH_COLOR,
          borderRadius: '1px',
        }} />
      )}

      {/* The pill itself */}
      <Box
        ref={ref}
        onClick={() => onNodeSelect(node)}
        sx={{
          p: depth === 0 ? '7px 14px' : '5px 12px',
          borderRadius: '20px',
          mb: '4px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          maxWidth: '100%',
          background: isSelected
            ? `${domainColor}14`
            : isActive
              ? 'rgba(255,255,255,0.025)'
              : 'transparent',
          border: '1px solid',
          borderColor: isSelected
            ? `${domainColor}55`
            : isActive
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(255,255,255,0.03)',
          boxShadow: isSelected ? `0 0 10px ${domainColor}22` : 'none',
          opacity: isSuspended ? 0.3 : isCompleted ? 0.45 : isActive ? 1 : 0.55,
          filter: isSuspended ? 'grayscale(0.8)' : 'none',
          '&:hover': {
            background: isSelected ? `${domainColor}1a` : 'rgba(255,255,255,0.04)',
            borderColor: isSelected ? `${domainColor}70` : 'rgba(255,255,255,0.12)',
            transform: 'translateX(2px)',
          },
        }}
      >
        {/* Mini progress ring */}
        <Box sx={{
          position: 'relative',
          width: depth === 0 ? 22 : 16,
          height: depth === 0 ? 22 : 16,
          flexShrink: 0,
        }}>
          <svg width="100%" height="100%" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
            <circle cx="11" cy="11" r="9" fill="none"
              stroke={isCompleted ? '#10B981' : domainColor}
              strokeWidth="2.5"
              strokeDasharray={`${(node.progress / 100) * 56.5} 56.5`}
              strokeLinecap="round"
              transform="rotate(-90 11 11)"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
        </Box>

        {/* Title */}
        <Typography sx={{
          fontWeight: depth === 0 ? 700 : 600,
          fontSize: depth === 0 ? '0.8rem' : '0.72rem',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: isActive ? 'text.primary' : 'text.disabled',
        }}>
          {isSuspended ? '⏸ ' : isCompleted ? '✓ ' : ''}{node.title}
        </Typography>

        {/* Progress % */}
        <Typography sx={{
          fontSize: '0.6rem',
          fontWeight: 800,
          color: isCompleted ? '#10B981' : `${domainColor}cc`,
          ml: 'auto',
          flexShrink: 0,
        }}>
          {node.progress}%
        </Typography>
      </Box>

      {/* Tracker pills — compact, inline below root goals */}
      {trackers.length > 0 && (
        <Box sx={{ display: 'flex', gap: '3px', flexWrap: 'wrap', ml: '34px', mb: '3px' }}>
          {trackers.map(t => (
            <Box
              key={t.id}
              onClick={(e) => { e.stopPropagation(); onLogTracker(t.id, node); }}
              sx={{
                fontSize: '0.55rem', px: '6px', py: '1px', borderRadius: '10px',
                bgcolor: t.bg, border: `1px solid ${t.border}`,
                color: t.color, cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '3px', fontWeight: 700,
                lineHeight: 1.3,
                '&:hover': { borderColor: t.color },
              }}
            >
              <span style={{ fontSize: '0.65rem' }}>{t.icon}</span>
              {t.label.replace(' Tracker', '').replace(' Counter', '')}
            </Box>
          ))}
        </Box>
      )}

      {/* Children — rendered inside the branch structure */}
      {hasChildren && (
        <Box sx={{ position: 'relative', mt: '1px' }}>
          {node.children.map((child, idx) => (
            <GoalPill
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              onLogTracker={onLogTracker}
              domainColor={domainColor}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ─── Main tree ──────────────────────────────────── */
const NotesCardTree: React.FC<NotesCardTreeProps> = ({
  nodes, selectedNodeId, onNodeSelect, onLogTracker, onAddGoal, readOnly,
}) => {
  const rootsByDomain = groupByDomain(nodes);
  const domainKeys = Object.keys(rootsByDomain);

  return (
    <Box sx={{ p: 1.5, pb: 4 }}>
      {/* Add goal button */}
      {onAddGoal && !readOnly && (
        <Box
          onClick={onAddGoal}
          sx={{
            p: '6px 16px', mb: 2, borderRadius: '20px', cursor: 'pointer',
            border: '1px dashed rgba(139,92,246,0.25)',
            background: 'rgba(139,92,246,0.03)',
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            transition: 'all 0.15s ease',
            '&:hover': { background: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.45)', transform: 'translateX(2px)' },
          }}
        >
          <Typography sx={{ fontSize: '0.85rem', color: '#A78BFA', fontWeight: 800, lineHeight: 1 }}>+</Typography>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#A78BFA' }}>
            New Goal
          </Typography>
        </Box>
      )}

      {domainKeys.map(domain => {
        const goals = rootsByDomain[domain];
        const progress = domainProgress(goals);
        const icon = DOMAIN_ICONS[domain] || '🎯';
        const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];

        return (
          <Box key={domain} sx={{ mb: 2, position: 'relative' }}>
            {/* Domain header — acts as the trunk root */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5,
              userSelect: 'none',
            }}>
              <Typography sx={{ fontSize: '0.85rem' }}>{icon}</Typography>
              <Typography sx={{
                fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.05em',
                color, textTransform: 'uppercase',
              }}>
                {domain}
              </Typography>
              {/* Thin progress bar */}
              <Box sx={{ flex: 1, height: 2, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, ml: 0.5 }}>
                <Box sx={{
                  height: '100%', width: `${progress}%`,
                  bgcolor: `${color}66`,
                  borderRadius: 1,
                  transition: 'width 0.3s ease',
                }} />
              </Box>
              <Typography sx={{ fontSize: '0.55rem', opacity: 0.35, fontWeight: 700 }}>{progress}%</Typography>
            </Box>

            {/* Main trunk line + goals */}
            <Box sx={{ position: 'relative', pl: '10px' }}>
              {/* Vertical trunk from domain header down through all goals */}
              <Box sx={{
                position: 'absolute',
                left: '4px',
                top: 0,
                width: '2px',
                height: 'calc(100% - 16px)',
                background: `linear-gradient(to bottom, ${color}40, ${color}10)`,
                borderRadius: '1px',
              }} />
              {goals.map((goal, idx) => (
                <Box key={goal.id} sx={{ position: 'relative', pl: '14px', mb: '2px' }}>
                  {/* Horizontal branch from trunk to this root goal */}
                  <Box sx={{
                    position: 'absolute',
                    left: '-6px',
                    top: '14px',
                    width: '16px',
                    height: '2px',
                    background: `${color}35`,
                    borderRadius: '1px',
                  }} />
                  {/* Branch dot at junction */}
                  <Box sx={{
                    position: 'absolute',
                    left: '-9px',
                    top: '11px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    bgcolor: `${color}55`,
                    border: `1.5px solid ${color}`,
                    zIndex: 1,
                  }} />
                  <GoalPill
                    node={goal}
                    depth={0}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={onNodeSelect}
                    onLogTracker={onLogTracker}
                    domainColor={color}
                    isLast={idx === goals.length - 1}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default NotesCardTree;
