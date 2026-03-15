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
      p: size === 'domain' ? '9px 18px' : '7px 14px',
      borderRadius: '18px',
      mb: '4px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      border: '1px dashed',
      borderColor: `${color}40`,
      background: 'transparent',
      opacity: 0.55,
      transition: 'all 0.15s ease',
      '&:hover': {
        opacity: 0.9,
        borderColor: `${color}70`,
        background: `${color}0c`,
        transform: 'translateX(2px)',
      },
    }}
  >
    <Typography sx={{
      fontSize: size === 'domain' ? '1rem' : '0.9rem',
      fontWeight: 700,
      color: `${color}cc`,
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
  const branchItems = node.children.length + (onAddSubgoal && isActive ? 1 : 0);

  return (
    <Box sx={{ position: 'relative', pl: depth > 0 ? '24px' : 0 }}>
      {/* Horizontal branch connector */}
      {depth > 0 && (
        <Box sx={{
          position: 'absolute', left: 0, top: '16px',
          width: '20px', height: '2px',
          background: isActive ? `${domainColor}50` : `${domainColor}22`,
          borderRadius: '1px',
        }} />
      )}
      {/* Vertical trunk connecting siblings */}
      {depth > 0 && (
        <Box sx={{
          position: 'absolute', left: 0, top: 0,
          width: '2px', height: isLast ? '17px' : '100%',
          background: isActive ? `${domainColor}45` : `${domainColor}1a`,
          borderRadius: '1px',
        }} />
      )}

      {/* The pill */}
      <Box
        ref={ref}
        onClick={() => onNodeSelect(node)}
        sx={{
          p: depth === 0 ? '10px 16px' : '8px 14px',
          borderRadius: '18px',
          mb: '4px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          maxWidth: '100%',
          background: isSelected
            ? `${domainColor}1a`
            : isActive
              ? 'rgba(255,255,255,0.03)'
              : 'transparent',
          border: '1px solid',
          borderColor: isSelected
            ? `${domainColor}60`
            : isActive
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(255,255,255,0.05)',
          boxShadow: isSelected ? `0 0 12px ${domainColor}28` : 'none',
          opacity: isSuspended ? 0.3 : isCompleted ? 0.45 : 1,
          filter: isSuspended ? 'grayscale(0.8)' : 'none',
          '&:hover': {
            background: isSelected ? `${domainColor}22` : 'rgba(255,255,255,0.05)',
            borderColor: isSelected ? `${domainColor}75` : 'rgba(255,255,255,0.14)',
            transform: 'translateX(2px)',
          },
        }}
      >
        {/* Progress ring */}
        <Box sx={{
          width: depth === 0 ? 30 : 22,
          height: depth === 0 ? 30 : 22,
          flexShrink: 0,
        }}>
          <svg width="100%" height="100%" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
            <circle cx="10" cy="10" r="8" fill="none"
              stroke={isCompleted ? '#10B981' : domainColor}
              strokeWidth="2.5"
              strokeDasharray={`${(node.progress / 100) * 50.3} 50.3`}
              strokeLinecap="round"
              transform="rotate(-90 10 10)"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
        </Box>

        <Typography sx={{
          fontWeight: depth === 0 ? 700 : 600,
          fontSize: depth === 0 ? '1.05rem' : '0.95rem',
          lineHeight: 1.25,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: isActive ? '#F3F4F6' : 'rgba(255,255,255,0.4)',
        }}>
          {isSuspended ? '⏸ ' : isCompleted ? '✓ ' : ''}{node.title}
        </Typography>

        <Typography sx={{
          fontSize: '0.8rem', fontWeight: 800,
          color: isCompleted ? '#10B981' : domainColor,
          ml: 'auto', flexShrink: 0,
        }}>
          {node.progress}%
        </Typography>
      </Box>

      {/* Tracker pills */}
      {trackers.length > 0 && (
        <Box sx={{ display: 'flex', gap: '4px', flexWrap: 'wrap', ml: '36px', mb: '3px' }}>
          {trackers.map(t => (
            <Box
              key={t.id}
              onClick={(e) => { e.stopPropagation(); onLogTracker(t.id, node); }}
              sx={{
                fontSize: '0.75rem', px: '9px', py: '3px', borderRadius: '12px',
                bgcolor: t.bg, border: `1px solid ${t.border}`,
                color: t.color, cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '3px', fontWeight: 700,
                lineHeight: 1.3,
                '&:hover': { borderColor: t.color, transform: 'scale(1.04)' },
                transition: 'all 0.1s ease',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{t.icon}</span>
              {t.label.replace(' Tracker', '').replace(' Counter', '')}
            </Box>
          ))}
        </Box>
      )}

      {/* Children + add-sub pill */}
      {(hasChildren || (onAddSubgoal && isActive)) && (
        <Box sx={{ position: 'relative', mt: '2px' }}>
          {/* Vertical trunk for children branch */}
          {branchItems > 0 && (
            <Box sx={{
              position: 'absolute', left: '24px', top: 0,
              width: '2px',
              height: `calc(100% - 14px)`,
              background: `${domainColor}28`,
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
            <Box sx={{ position: 'relative', pl: '24px' }}>
              {/* connector line */}
              <Box sx={{
                position: 'absolute', left: 0, top: '12px',
                width: '20px', height: '2px',
                background: `${domainColor}22`, borderRadius: '1px',
              }} />
              <Box sx={{
                position: 'absolute', left: 0, top: 0,
                width: '2px', height: '13px',
                background: `${domainColor}1a`, borderRadius: '1px',
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
    <Box sx={{ p: 2, pb: 5 }}>
      {ALL_DOMAINS.map(domain => {
        const goals = rootsByDomain[domain] || [];
        const hasGoals = goals.length > 0;
        const progress = domainProgress(goals);
        const icon = DOMAIN_ICONS[domain] || '🎯';
        const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];

        return (
          <Box key={domain} sx={{ mb: 2, position: 'relative' }}>
            {/* Domain header — trunk root */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, mb: 0.75,
              userSelect: 'none',
              opacity: hasGoals ? 1 : 0.45,
              transition: 'opacity 0.2s',
              '&:hover': { opacity: hasGoals ? 1 : 0.7 },
            }}>
              <Typography sx={{ fontSize: '1.15rem' }}>{icon}</Typography>
              <Typography sx={{
                fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.04em',
                color, textTransform: 'uppercase',
              }}>
                {domain}
              </Typography>
              {hasGoals && (
                <>
                  <Box sx={{ flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1.5, ml: 0.5 }}>
                    <Box sx={{
                      height: '100%', width: `${progress}%`,
                      bgcolor: `${color}66`,
                      borderRadius: 1.5,
                      transition: 'width 0.3s ease',
                    }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{progress}%</Typography>
                </>
              )}
            </Box>

            {/* Trunk + goals */}
            <Box sx={{ position: 'relative', pl: '12px' }}>
              {/* Vertical trunk */}
              {(hasGoals || (!readOnly && onAddGoalInDomain)) && (
                <Box sx={{
                  position: 'absolute', left: '5px', top: 0,
                  width: '2px',
                  height: hasGoals ? 'calc(100% - 12px)' : '16px',
                  background: hasGoals
                    ? `linear-gradient(to bottom, ${color}45, ${color}0c)`
                    : `${color}1a`,
                  borderRadius: '1px',
                }} />
              )}

              {goals.map((goal, idx) => (
                <Box key={goal.id} sx={{ position: 'relative', pl: '16px', mb: '2px' }}>
                  {/* Horizontal branch */}
                  <Box sx={{
                    position: 'absolute', left: '-7px', top: '14px',
                    width: '18px', height: '2px',
                    background: `${color}40`, borderRadius: '1px',
                  }} />
                  {/* Junction dot */}
                  <Box sx={{
                    position: 'absolute', left: '-9px', top: '11px',
                    width: '6px', height: '6px', borderRadius: '50%',
                    bgcolor: `${color}55`,
                    border: `1.5px solid ${color}99`,
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
                <Box sx={{ position: 'relative', pl: '16px' }}>
                  {/* Horizontal branch */}
                  <Box sx={{
                    position: 'absolute', left: '-7px', top: '12px',
                    width: '18px', height: '2px',
                    background: `${color}1a`, borderRadius: '1px',
                  }} />
                  {/* Trunk cap for last item */}
                  <Box sx={{
                    position: 'absolute', left: '-7px', top: 0,
                    width: '2px', height: '13px',
                    background: `${color}15`, borderRadius: '1px',
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
