import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';

interface GoalCardTreeProps {
  nodes: GoalNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onAddGoal: () => void;
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

const GoalCard: React.FC<{
  node: GoalNode;
  depth: number;
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
}> = ({ node, depth, selectedNodeId, onNodeSelect }) => {
  const isSelected = node.id === selectedNodeId;
  const isSuspended = node.status === 'suspended';
  const ref = useRef<HTMLDivElement>(null);

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
          background: isSelected ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
          border: '1px solid',
          borderColor: isSelected ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)',
          boxShadow: isSelected ? '0 0 12px rgba(139,92,246,0.15)' : 'none',
          opacity: isSuspended ? 0.35 : 1,
          filter: isSuspended ? 'grayscale(0.8)' : 'none',
          '&:hover': {
            background: isSelected ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.04)',
            borderColor: isSelected ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: depth > 0 ? '0.85rem' : '0.9rem' }}>
            {isSuspended ? '⏸ ' : ''}{node.title}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#A78BFA' }}>
            {node.progress}%
          </Typography>
        </Box>
        <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <Box sx={{
            height: '100%',
            width: `${node.progress}%`,
            background: 'linear-gradient(90deg, #F59E0B, #8B5CF6)',
            borderRadius: 2,
          }} />
        </Box>
        {depth === 0 && node.children.length > 0 && (
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
        />
      ))}
    </Box>
  );
};

const GoalCardTree: React.FC<GoalCardTreeProps> = ({
  nodes, selectedNodeId, onNodeSelect, onAddGoal, readOnly,
}) => {
  const rootsByDomain = groupByDomain(nodes);
  const domainKeys = Object.keys(rootsByDomain);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleDomain = (domain: string) => {
    setCollapsed(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

  return (
    <Box sx={{ p: 2 }}>
      {domainKeys.map(domain => {
        const goals = rootsByDomain[domain];
        const progress = domainProgress(goals);
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
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>
                ▼
              </Typography>
              <Typography sx={{ fontSize: '1rem' }}>{icon}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.03em' }}>
                {domain.toUpperCase()}
              </Typography>
              <Box sx={{ flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, ml: 1 }}>
                <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: `${color}66`, borderRadius: 2 }} />
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
                  />
                ))}
              </Box>
            </Collapse>
          </Box>
        );
      })}

      {!readOnly && (
        <Box
          onClick={onAddGoal}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, pt: 1.5, mt: 1,
            borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem',
            '&:hover': { color: 'rgba(255,255,255,0.5)' },
          }}
        >
          <Typography sx={{ fontSize: '1.1rem' }}>+</Typography>
          <Typography>Add new goal</Typography>
        </Box>
      )}
    </Box>
  );
};

export default GoalCardTree;
