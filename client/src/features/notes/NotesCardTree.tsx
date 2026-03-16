import React, { useRef, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';
import { Domain } from '../../models/Domain';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../trackers/trackerTypes';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';

interface NotesCardTreeProps {
  nodes: GoalNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  onAddGoal?: () => void;
  onAddGoalInDomain?: (domain: string) => void;
  onAddSubgoal?: (parentId: string) => void;
  onEdit?: (node: GoalNode) => void;
  onSuspend?: (node: GoalNode) => void;
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
    <AddIcon sx={{ fontSize: size === 'domain' ? '1rem' : '0.9rem', color: `${color}cc` }} />
    <Typography sx={{
      fontSize: size === 'domain' ? '1rem' : '0.9rem',
      fontWeight: 700,
      color: `${color}cc`,
      lineHeight: 1.2,
    }}>
      {label}
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
  onEdit?: (node: GoalNode) => void;
  onSuspend?: (node: GoalNode) => void;
  domainColor: string;
  isLast: boolean;
  readOnly?: boolean;
}> = ({ node, depth, selectedNodeId, onNodeSelect, onLogTracker, onAddSubgoal, onEdit, onSuspend, domainColor, isLast, readOnly }) => {
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
  const branchItems = node.children.length + (onAddSubgoal && isActive && !readOnly ? 1 : 0);

  return (
    <Box sx={{ position: 'relative', pl: depth > 0 ? '28px' : 0 }}>
      {/* Horizontal branch connector — curved look */}
      {depth > 0 && (
        <Box sx={{
          position: 'absolute', left: 0, top: '18px',
          width: '24px', height: '12px',
          borderLeft: '2px solid',
          borderBottom: '2px solid',
          borderColor: isActive ? `${domainColor}50` : `${domainColor}22`,
          borderBottomLeftRadius: '12px',
          zIndex: 0,
        }} />
      )}
      {/* Vertical trunk connecting siblings */}
      {depth > 0 && !isLast && (
        <Box sx={{
          position: 'absolute', left: 0, top: '18px',
          width: '2px', height: 'calc(100% - 10px)',
          background: isActive ? `${domainColor}45` : `${domainColor}1a`,
          borderRadius: '1px',
          zIndex: 0,
        }} />
      )}

      {/* The pill (Chapter/Page) */}
      <Box
        ref={ref}
        onClick={() => onNodeSelect(node)}
        sx={{
          p: depth === 0 ? '12px 18px' : '9px 15px',
          borderRadius: '14px',
          mb: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          maxWidth: '100%',
          background: isSelected
            ? `linear-gradient(135deg, ${domainColor}1a 0%, ${domainColor}0a 100%)`
            : isActive
              ? 'rgba(255,255,255,0.02)'
              : 'transparent',
          border: '1px solid',
          borderColor: isSelected
            ? `${domainColor}60`
            : isActive
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(255,255,255,0.05)',
          boxShadow: isSelected ? `0 4px 15px ${domainColor}15` : 'none',
          opacity: isSuspended ? 0.3 : isCompleted ? 0.6 : 1,
          '&:hover': {
            background: isSelected ? `${domainColor}22` : 'rgba(255,255,255,0.04)',
            borderColor: isSelected ? `${domainColor}80` : 'rgba(255,255,255,0.15)',
            transform: 'translateX(4px)',
          },
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Progress ring / Status */}
        <Box sx={{
          width: depth === 0 ? 32 : 24,
          height: depth === 0 ? 32 : 24,
          flexShrink: 0,
          position: 'relative',
        }}>
          <svg width="100%" height="100%" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
            <circle cx="10" cy="10" r="8" fill="none"
              stroke={isCompleted ? '#10B981' : domainColor}
              strokeWidth="3"
              strokeDasharray={`${(node.progress / 100) * 50.3} 50.3`}
              strokeLinecap="round"
              transform="rotate(-90 10 10)"
              style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
            />
          </svg>
          {isSuspended && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PauseCircleOutlineIcon sx={{ fontSize: '0.8rem', color: 'text.secondary' }} />
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontWeight: depth === 0 ? 800 : 700,
            fontSize: depth === 0 ? '1.05rem' : '0.92rem',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isActive ? '#F3F4F6' : 'rgba(255,255,255,0.5)',
            mb: 0.2,
          }}>
            {node.title}
          </Typography>
          {depth === 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {hasChildren ? `${node.children.length} Chapters` : 'Main Topic (Goal)'}
            </Typography>
          )}
        </Box>

        {/* Action icons on hover */}
        {!readOnly && (
          <Box className="node-actions" sx={{
            display: 'flex', gap: 0.5,
            opacity: 0,
            transition: 'opacity 0.2s',
            '.MuiBox-root:hover &': { opacity: 1 }
          }}>
            {onEdit && (
              <Tooltip title="Edit Goal Details">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(node); }} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <EditIcon sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Tooltip>
            )}
            {onAddSubgoal && isActive && (
              <Tooltip title="Add Chapter (Sub-goal)">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddSubgoal(node.id); }} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <AddIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        <Typography sx={{
          fontSize: '0.8rem', fontWeight: 900,
          color: isCompleted ? '#10B981' : domainColor,
          ml: 'auto', flexShrink: 0,
          fontFamily: 'monospace'
        }}>
          {node.progress}%
        </Typography>
      </Box>

      {/* Tracker pills — quick entry for roots */}
      {trackers.length > 0 && (
        <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', ml: '48px', mb: '8px', mt: '-2px' }}>
          {trackers.map(t => (
            <Box
              key={t.id}
              onClick={(e) => { e.stopPropagation(); onLogTracker(t.id, node); }}
              sx={{
                fontSize: '0.72rem', px: '10px', py: '4px', borderRadius: '10px',
                bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)`,
                color: 'text.secondary', cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '4px', fontWeight: 700,
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: t.color,
                  color: t.color,
                  bgcolor: `${t.color}11`,
                  transform: 'translateY(-1px)'
                },
              }}
            >
              <span style={{ fontSize: '0.8rem' }}>{t.icon}</span>
              {t.label.replace(' Tracker', '').replace(' Counter', '')}
            </Box>
          ))}
        </Box>
      )}

      {/* Chapters (Children) */}
      {(hasChildren || (onAddSubgoal && isActive && !readOnly)) && (
        <Box sx={{ position: 'relative', mt: '2px' }}>
          {/* Stem path to children */}
          <Box sx={{
            position: 'absolute', left: '12px', top: 0,
            width: '2px',
            height: '24px',
            background: `linear-gradient(to bottom, ${domainColor}33, ${domainColor}1a)`,
            borderRadius: '1px',
          }} />

          {node.children.map((child, idx) => (
            <GoalPill
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              onLogTracker={onLogTracker}
              onAddSubgoal={onAddSubgoal}
              onEdit={onEdit}
              onSuspend={onSuspend}
              domainColor={domainColor}
              isLast={idx === node.children.length - 1 && !(onAddSubgoal && isActive && !readOnly)}
              readOnly={readOnly}
            />
          ))}

          {/* Add-chapter ghost pill */}
          {onAddSubgoal && isActive && !readOnly && (
            <Box sx={{ position: 'relative', pl: '28px' }}>
              <Box sx={{
                position: 'absolute', left: 0, top: '18px',
                width: '24px', height: '12px',
                borderLeft: '2px solid',
                borderBottom: '2px dashed',
                borderColor: `${domainColor}22`,
                borderBottomLeftRadius: '12px',
              }} />
              <AddPill
                label="New Chapter (Sub-goal)"
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

/* ─── Main Notebook TOC ──────────────────────────── */
const NotesCardTree: React.FC<NotesCardTreeProps> = ({
  nodes, selectedNodeId, onNodeSelect, onLogTracker, onAddGoal, onAddGoalInDomain, onAddSubgoal, onEdit, onSuspend, readOnly,
}) => {
  const rootsByDomain = groupByDomain(nodes);

  return (
    <Box sx={{ p: 2, pb: 8 }}>
      {ALL_DOMAINS.map(domain => {
        const goals = rootsByDomain[domain] || [];
        const hasGoals = goals.length > 0;
        const progress = domainProgress(goals);
        const icon = DOMAIN_ICONS[domain] || '🎯';
        const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];

        return (
          <Box key={domain} sx={{ mb: 4, position: 'relative' }}>
            {/* Domain Root (The Stem Start) */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5,
              opacity: hasGoals ? 1 : 0.5,
              transition: 'opacity 0.3s',
            }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: `${color}15`, border: `1px solid ${color}33`,
                boxShadow: `0 0 15px ${color}10`,
              }}>
                <Typography sx={{ fontSize: '1.4rem' }}>{icon}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{
                  fontWeight: 900, fontSize: '0.85rem', letterSpacing: '0.1em',
                  color, textTransform: 'uppercase',
                }}>
                  {domain}
                </Typography>
                {hasGoals && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.2 }}>
                    <Box sx={{ flex: 1, height: 4, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                      <Box sx={{
                        height: '100%', width: `${progress}%`,
                        bgcolor: color,
                        borderRadius: 2,
                        boxShadow: `0 0 8px ${color}66`,
                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                      }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 800 }}>{progress}%</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* The Main Stem */}
            <Box sx={{ position: 'relative', pl: '20px' }}>
              {/* Vertical trunk */}
              <Box sx={{
                position: 'absolute', left: '19px', top: -10,
                width: '3px',
                height: hasGoals ? 'calc(100% + 10px)' : '20px',
                background: `linear-gradient(to bottom, ${color}66 0%, ${color}11 100%)`,
                borderRadius: '2px',
                zIndex: 0,
              }} />

              {goals.map((goal, idx) => (
                <Box key={goal.id} sx={{ position: 'relative', mb: '4px' }}>
                  <GoalPill
                    node={goal}
                    depth={0}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={onNodeSelect}
                    onLogTracker={onLogTracker}
                    onAddSubgoal={onAddSubgoal}
                    onEdit={onEdit}
                    onSuspend={onSuspend}
                    domainColor={color}
                    isLast={idx === goals.length - 1 && !(!readOnly && onAddGoalInDomain)}
                    readOnly={readOnly}
                  />
                </Box>
              ))}

              {/* Add Topic (New Stem Branch) */}
              {!readOnly && onAddGoalInDomain && (
                <Box sx={{ position: 'relative', pl: '28px', mt: 1 }}>
                  <Box sx={{
                    position: 'absolute', left: 0, top: '18px',
                    width: '24px', height: '12px',
                    borderLeft: '2px solid',
                    borderBottom: '2px dashed',
                    borderColor: `${color}22`,
                    borderBottomLeftRadius: '12px',
                  }} />
                  <AddPill
                    label="New Topic (Goal)"
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
