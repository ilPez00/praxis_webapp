import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
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

/** A domain is "active" if it has at least one non-suspended, non-completed goal */
function isDomainActive(goals: GoalNode[]): boolean {
  return goals.some(g => g.status !== 'suspended' && g.progress < 100);
}

const GoalCard: React.FC<{
  node: GoalNode;
  depth: number;
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  domainActive: boolean;
}> = ({ node, depth, selectedNodeId, onNodeSelect, onLogTracker, domainActive }) => {
  const isSelected = node.id === selectedNodeId;
  const isSuspended = node.status === 'suspended';
  const isCompleted = node.progress >= 100;
  const isActive = !isSuspended && !isCompleted;
  const ref = useRef<HTMLDivElement>(null);

  // Get tracker types for this root goal's domain
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

  return (
    <Box sx={{ ml: depth > 0 ? 2 : 0 }}>
      <Box
        ref={ref}
        onClick={() => onNodeSelect(node)}
        sx={{
          p: '10px 14px',
          borderRadius: '12px',
          mb: 0.75,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: isSelected
            ? 'rgba(139,92,246,0.06)'
            : isActive && domainActive
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(255,255,255,0.01)',
          border: '1px solid',
          borderColor: isSelected
            ? 'rgba(139,92,246,0.3)'
            : isActive && domainActive
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.04)',
          boxShadow: isSelected ? '0 0 12px rgba(139,92,246,0.15)' : 'none',
          opacity: isSuspended ? 0.35 : isCompleted ? 0.5 : 1,
          filter: isSuspended ? 'grayscale(0.8)' : 'none',
          '&:hover': {
            background: isSelected ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.04)',
            borderColor: isSelected ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: depth > 0 ? '0.85rem' : '0.9rem' }}>
            {isSuspended ? '⏸ ' : isCompleted ? '✓ ' : ''}{node.title}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: isCompleted ? '#10B981' : '#A78BFA' }}>
            {node.progress}%
          </Typography>
        </Box>
        <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <Box sx={{
            height: '100%',
            width: `${node.progress}%`,
            background: isCompleted
              ? '#10B981'
              : 'linear-gradient(90deg, #F59E0B, #8B5CF6)',
            borderRadius: 2,
          }} />
        </Box>

        {/* Tracker pills — only on active root goals */}
        {trackers.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {trackers.map(t => (
              <Box
                key={t.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onLogTracker(t.id, node);
                }}
                sx={{
                  fontSize: '0.625rem', px: 1, py: 0.25, borderRadius: '6px',
                  bgcolor: t.bg, border: `1px solid ${t.border}`,
                  color: t.color, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 0.5, fontWeight: 700,
                  '&:hover': { borderColor: t.color, bgcolor: `${t.bg}` },
                }}
              >
                <span style={{ fontSize: '0.75rem' }}>{t.icon}</span>
                {t.label.replace(' Tracker', '').replace(' Counter', '')}
              </Box>
            ))}
          </Box>
        )}

        {/* Sub-goal pills for non-active root goals */}
        {depth === 0 && trackers.length === 0 && node.children.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {node.children.slice(0, 3).map(child => (
              <Box key={child.id} sx={{
                fontSize: '0.625rem', px: 1, py: 0.25, borderRadius: '6px',
                bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', maxWidth: 120,
              }}>
                {child.title}
              </Box>
            ))}
            {node.children.length > 3 && (
              <Box sx={{ fontSize: '0.625rem', px: 1, py: 0.25, color: 'rgba(255,255,255,0.3)' }}>
                +{node.children.length - 3}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {node.children.map(child => (
        <GoalCard
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          onNodeSelect={onNodeSelect}
          onLogTracker={onLogTracker}
          domainActive={domainActive}
        />
      ))}
    </Box>
  );
};

const NotesCardTree: React.FC<NotesCardTreeProps> = ({
  nodes, selectedNodeId, onNodeSelect, onLogTracker, onAddGoal, readOnly,
}) => {
  const rootsByDomain = groupByDomain(nodes);
  const domainKeys = Object.keys(rootsByDomain);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleDomain = (domain: string) => {
    setCollapsed(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

  return (
    <Box sx={{ p: 2 }}>
      {onAddGoal && !readOnly && (
        <Box
          onClick={onAddGoal}
          sx={{
            p: '10px 14px', mb: 2, borderRadius: '12px', cursor: 'pointer',
            border: '1px dashed rgba(139,92,246,0.3)',
            background: 'rgba(139,92,246,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            transition: 'all 0.2s ease',
            '&:hover': { background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.5)' },
          }}
        >
          <Typography sx={{ fontSize: '1rem' }}>+</Typography>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#A78BFA' }}>
            Add New Goal
          </Typography>
        </Box>
      )}
      {domainKeys.map(domain => {
        const goals = rootsByDomain[domain];
        const progress = domainProgress(goals);
        const active = isDomainActive(goals);
        const icon = DOMAIN_ICONS[domain] || '🎯';
        const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];
        const isCollapsed = collapsed[domain] ?? false;

        return (
          <Box key={domain} sx={{ mb: 2 }}>
            <Box
              onClick={() => toggleDomain(domain)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1, cursor: 'pointer',
                userSelect: 'none',
                opacity: active ? 1 : 0.45,
              }}
            >
              <Typography sx={{
                fontSize: '0.75rem', color,
                transition: 'transform 0.2s',
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
              }}>
                ▼
              </Typography>
              <Typography sx={{ fontSize: '1rem' }}>{icon}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.03em' }}>
                {domain.toUpperCase()}
              </Typography>
              <Box sx={{ flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, ml: 1 }}>
                <Box sx={{
                  height: '100%', width: `${progress}%`,
                  bgcolor: active ? `${color}88` : `${color}33`,
                  borderRadius: 2,
                  boxShadow: active ? `0 0 6px ${color}44` : 'none',
                }} />
              </Box>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.4 }}>{progress}%</Typography>
            </Box>
            <Collapse in={!isCollapsed}>
              <Box sx={{ ml: 1.5 }}>
                {goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    node={goal}
                    depth={0}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={onNodeSelect}
                    onLogTracker={onLogTracker}
                    domainActive={active}
                  />
                ))}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
};

export default NotesCardTree;
