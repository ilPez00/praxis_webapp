import React, { useRef, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';
import { Domain } from '../../models/Domain';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../trackers/trackerTypes';

interface NotesCardTreeProps {
  nodes: GoalNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  onAddGoal?: () => void;
  onAddGoalInDomain?: (domain: string) => void;
  onAddSubgoal?: (parentId: string) => void;
  readOnly?: boolean;
}

/** All domains, always shown */
const ALL_DOMAINS = Object.values(Domain);

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

/* ─── Add-goal ghost pill ────────────────────────── */
const AddPill: React.FC<{
  label: string;
  color: string;
  onClick: () => void;
  size?: 'domain' | 'sub';
}> = ({ label, color, onClick, size = 'sub' }) => (
  <Box
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    sx={{
      p: size === 'domain' ? '5px 14px' : '3px 10px',
      borderRadius: '16px',
      mb: '3px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      border: '1px dashed',
      borderColor: `${color}30`,
      background: 'transparent',
      opacity: 0.45,
      transition: 'all 0.15s ease',
      '&:hover': {
        opacity: 0.85,
        borderColor: `${color}60`,
        background: `${color}08`,
        transform: 'translateX(2px)',
      },
    }}
  >
    <Typography sx={{
      fontSize: size === 'domain' ? '0.7rem' : '0.6rem',
      fontWeight: 700,
      color: `${color}99`,
      lineHeight: 1.2,
    }}>
      + {label}
    </Typography>
  </Box>
);

/* ─── Compact pill node ──────────────────────────── */
const GoalPill: React.FC<{
  node: GoalNode;
  depth: number;
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  onAddSubgoal?: (parentId: string) => void;
  domainColor: string;
  isLast: boolean;
}> = ({ node, depth, selectedNodeId, onNodeSelect, onLogTracker, onAddSubgoal, domainColor, isLast }) => {
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
  // Count total items in this branch (children + add-sub pill)
  const branchItems = node.children.length + (onAddSubgoal && isActive ? 1 : 0);

  return (
    <Box sx={{ position: 'relative', pl: depth > 0 ? '20px' : 0 }}>
      {/* Horizontal branch connector */}
      {depth > 0 && (
        <Box sx={{
          position: 'absolute', left: 0, top: '13px',
          width: '16px', height: '2px',
          background: isActive ? `${domainColor}40` : `${domainColor}18`,
          borderRadius: '1px',
        }} />
      )}
      {/* Vertical trunk connecting siblings */}
      {depth > 0 && (
        <Box sx={{
          position: 'absolute', left: 0, top: 0,
          width: '2px', height: isLast ? '14px' : '100%',
          background: isActive ? `${domainColor}35` : `${domainColor}15`,
          borderRadius: '1px',
        }} />
      )}

      {/* The pill */}
      <Box
        ref={ref}
        onClick={() => onNodeSelect(node)}
        sx={{
          p: depth === 0 ? '6px 12px' : '4px 10px',
          borderRadius: '16px',
          mb: '3px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          maxWidth: '100%',
          background: isSelected
            ? `${domainColor}14`
            : isActive
              ? 'rgba(255,255,255,0.02)'
              : 'transparent',
          border: '1px solid',
          borderColor: isSelected
            ? `${domainColor}50`
            : isActive
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.025)',
          boxShadow: isSelected ? `0 0 8px ${domainColor}20` : 'none',
          opacity: isSuspended ? 0.28 : isCompleted ? 0.4 : 1,
          filter: isSuspended ? 'grayscale(0.8)' : 'none',
          '&:hover': {
            background: isSelected ? `${domainColor}1a` : 'rgba(255,255,255,0.035)',
            borderColor: isSelected ? `${domainColor}65` : 'rgba(255,255,255,0.1)',
            transform: 'translateX(2px)',
          },
        }}
      >
        {/* Progress ring */}
        <Box sx={{
          width: depth === 0 ? 20 : 14,
          height: depth === 0 ? 20 : 14,
          flexShrink: 0,
        }}>
          <svg width="100%" height="100%" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
            <circle cx="10" cy="10" r="8" fill="none"
              stroke={isCompleted ? '#10B981' : domainColor}
              strokeWidth="2"
              strokeDasharray={`${(node.progress / 100) * 50.3} 50.3`}
              strokeLinecap="round"
              transform="rotate(-90 10 10)"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
        </Box>

        <Typography sx={{
          fontWeight: depth === 0 ? 700 : 600,
          fontSize: depth === 0 ? '0.75rem' : '0.68rem',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: isActive ? 'text.primary' : 'text.disabled',
        }}>
          {isSuspended ? '⏸ ' : isCompleted ? '✓ ' : ''}{node.title}
        </Typography>

        <Typography sx={{
          fontSize: '0.55rem', fontWeight: 800,
          color: isCompleted ? '#10B981' : `${domainColor}bb`,
          ml: 'auto', flexShrink: 0,
        }}>
          {node.progress}%
        </Typography>
      </Box>

      {/* Tracker pills */}
      {trackers.length > 0 && (
        <Box sx={{ display: 'flex', gap: '3px', flexWrap: 'wrap', ml: '30px', mb: '2px' }}>
          {trackers.map(t => (
            <Box
              key={t.id}
              onClick={(e) => { e.stopPropagation(); onLogTracker(t.id, node); }}
              sx={{
                fontSize: '0.5rem', px: '5px', py: '1px', borderRadius: '8px',
                bgcolor: t.bg, border: `1px solid ${t.border}`,
                color: t.color, cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '2px', fontWeight: 700,
                lineHeight: 1.3,
                '&:hover': { borderColor: t.color },
              }}
            >
              <span style={{ fontSize: '0.6rem' }}>{t.icon}</span>
              {t.label.replace(' Tracker', '').replace(' Counter', '')}
            </Box>
          ))}
        </Box>
      )}

      {/* Children + add-sub pill */}
      {(hasChildren || (onAddSubgoal && isActive)) && (
        <Box sx={{ position: 'relative', mt: '1px' }}>
          {/* Vertical trunk for children branch */}
          {branchItems > 0 && (
            <Box sx={{
              position: 'absolute', left: '20px', top: 0,
              width: '2px',
              height: `calc(100% - 12px)`,
              background: `${domainColor}20`,
              borderRadius: '1px',
            }} />
          )}
          {node.children.map((child, idx) => (
            <GoalPill
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              onLogTracker={onLogTracker}
              onAddSubgoal={onAddSubgoal}
              domainColor={domainColor}
              isLast={idx === node.children.length - 1 && !(onAddSubgoal && isActive)}
            />
          ))}
          {/* Add sub-goal pill at end of children */}
          {onAddSubgoal && isActive && (
            <Box sx={{ position: 'relative', pl: '20px' }}>
              {/* connector line */}
              <Box sx={{
                position: 'absolute', left: 0, top: '10px',
                width: '16px', height: '2px',
                background: `${domainColor}18`, borderRadius: '1px',
              }} />
              <Box sx={{
                position: 'absolute', left: 0, top: 0,
                width: '2px', height: '11px',
                background: `${domainColor}15`, borderRadius: '1px',
              }} />
              <AddPill
                label="sub-goal"
                color={domainColor}
                onClick={() => onAddSubgoal(node.id)}
                size="sub"
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

/* ─── Main tree ──────────────────────────────────── */
const NotesCardTree: React.FC<NotesCardTreeProps> = ({
  nodes, selectedNodeId, onNodeSelect, onLogTracker, onAddGoal, onAddGoalInDomain, onAddSubgoal, readOnly,
}) => {
  const rootsByDomain = groupByDomain(nodes);

  return (
    <Box sx={{ p: 1.5, pb: 4 }}>
      {ALL_DOMAINS.map(domain => {
        const goals = rootsByDomain[domain] || [];
        const hasGoals = goals.length > 0;
        const progress = domainProgress(goals);
        const icon = DOMAIN_ICONS[domain] || '🎯';
        const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];

        return (
          <Box key={domain} sx={{ mb: 1.5, position: 'relative' }}>
            {/* Domain header — trunk root */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5,
              userSelect: 'none',
              opacity: hasGoals ? 1 : 0.4,
              transition: 'opacity 0.2s',
              '&:hover': { opacity: hasGoals ? 1 : 0.65 },
            }}>
              <Typography sx={{ fontSize: '0.8rem' }}>{icon}</Typography>
              <Typography sx={{
                fontWeight: 800, fontSize: '0.6rem', letterSpacing: '0.04em',
                color, textTransform: 'uppercase',
              }}>
                {domain}
              </Typography>
              {hasGoals && (
                <>
                  <Box sx={{ flex: 1, height: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1, ml: 0.5 }}>
                    <Box sx={{
                      height: '100%', width: `${progress}%`,
                      bgcolor: `${color}55`,
                      borderRadius: 1,
                      transition: 'width 0.3s ease',
                    }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.5rem', opacity: 0.3, fontWeight: 700 }}>{progress}%</Typography>
                </>
              )}
            </Box>

            {/* Trunk + goals */}
            <Box sx={{ position: 'relative', pl: '10px' }}>
              {/* Vertical trunk */}
              {(hasGoals || (!readOnly && onAddGoalInDomain)) && (
                <Box sx={{
                  position: 'absolute', left: '4px', top: 0,
                  width: '2px',
                  height: hasGoals ? 'calc(100% - 10px)' : '14px',
                  background: hasGoals
                    ? `linear-gradient(to bottom, ${color}35, ${color}08)`
                    : `${color}15`,
                  borderRadius: '1px',
                }} />
              )}

              {goals.map((goal, idx) => (
                <Box key={goal.id} sx={{ position: 'relative', pl: '14px', mb: '1px' }}>
                  {/* Horizontal branch */}
                  <Box sx={{
                    position: 'absolute', left: '-6px', top: '12px',
                    width: '16px', height: '2px',
                    background: `${color}30`, borderRadius: '1px',
                  }} />
                  {/* Junction dot */}
                  <Box sx={{
                    position: 'absolute', left: '-8px', top: '9px',
                    width: '5px', height: '5px', borderRadius: '50%',
                    bgcolor: `${color}44`,
                    border: `1.5px solid ${color}88`,
                    zIndex: 1,
                  }} />
                  <GoalPill
                    node={goal}
                    depth={0}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={onNodeSelect}
                    onLogTracker={onLogTracker}
                    onAddSubgoal={onAddSubgoal}
                    domainColor={color}
                    isLast={idx === goals.length - 1 && !(!readOnly && onAddGoalInDomain)}
                  />
                </Box>
              ))}

              {/* Add-goal-in-domain pill (always visible as last branch) */}
              {!readOnly && onAddGoalInDomain && (
                <Box sx={{ position: 'relative', pl: '14px' }}>
                  {/* Horizontal branch */}
                  <Box sx={{
                    position: 'absolute', left: '-6px', top: '10px',
                    width: '16px', height: '2px',
                    background: `${color}15`, borderRadius: '1px',
                  }} />
                  {/* Trunk cap for last item */}
                  <Box sx={{
                    position: 'absolute', left: '-6px', top: 0,
                    width: '2px', height: '11px',
                    background: `${color}12`, borderRadius: '1px',
                  }} />
                  <AddPill
                    label="goal"
                    color={color}
                    onClick={() => onAddGoalInDomain(domain)}
                    size="domain"
                  />
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default NotesCardTree;
