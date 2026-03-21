/**
 * GoalTreeTimeline — Vertical timeline-style visualization.
 * 
 * Design:
 *  - Clean vertical flow from trunk → domains → goals → subgoals
 *  - Modern card-based nodes with glassmorphism
 *  - Smooth bezier connecting lines with gradient strokes
 *  - Progress bars with animated fills
 *  - Domain color coding with subtle gradients
 *  - Hover effects with scale & glow
 */

import React, { useMemo } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';
import { Domain } from '../../../models/Domain';

const ALL_DOMAINS = Object.values(Domain);

const DOMAIN_SHORT: Record<string, string> = {
  [Domain.BODY_FITNESS]: 'Fitness',
  [Domain.REST_RECOVERY]: 'Recovery',
  [Domain.MENTAL_BALANCE]: 'Mental',
  [Domain.ENVIRONMENT_HOME]: 'Home',
  [Domain.HEALTH_LONGEVITY]: 'Longevity',
  [Domain.FINANCIAL_SECURITY]: 'Safety',
  [Domain.FRIENDSHIP_SOCIAL]: 'Social',
  [Domain.ROMANCE_INTIMACY]: 'Romance',
  [Domain.COMMUNITY_CONTRIBUTION]: 'Impact',
  [Domain.CAREER_CRAFT]: 'Career',
  [Domain.WEALTH_ASSETS]: 'Wealth',
  [Domain.GAMING_ESPORTS]: 'Gaming',
  [Domain.IMPACT_LEGACY]: 'Legacy',
  [Domain.SPIRIT_PURPOSE]: 'Spirit',
};

interface Props {
  rootNodes: GoalNode[];
  domainProficiency?: Record<string, number>;
  memberSince?: string;
  onNodeClick?: (node: GoalNode) => void;
  onRootClick?: () => void;
}

const GoalTreeTimeline: React.FC<Props> = ({
  rootNodes,
  domainProficiency = {},
  memberSince,
  onNodeClick,
  onRootClick,
}) => {
  // Group user goals by domain
  const goalsByDomain = useMemo(() => {
    const map = new Map<string, GoalNode[]>();
    for (const node of rootNodes) {
      if (!node.domain) continue;
      if (!map.has(node.domain)) map.set(node.domain, []);
      map.get(node.domain)!.push(node);
    }
    return map;
  }, [rootNodes]);

  return (
    <Box sx={{ 
      px: 2, py: 4, 
      background: 'linear-gradient(180deg, rgba(10,11,20,0.8) 0%, rgba(17,24,39,0.9) 100%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.06)',
      minHeight: '400px',
    }}>
      {/* Trunk Origin */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box
          onClick={onRootClick}
          sx={{
            width: 80, height: 80, mx: 'auto', mb: 2,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: onRootClick ? 'pointer' : 'default',
            boxShadow: '0 0 30px rgba(245,158,11,0.4), inset 0 0 20px rgba(255,255,255,0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': onRootClick ? {
              transform: 'scale(1.05)',
              boxShadow: '0 0 40px rgba(245,158,11,0.6), inset 0 0 30px rgba(255,255,255,0.2)',
            } : {},
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 24, fontWeight: 900 }}>🌳</Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#0A0B14' }}>
              {memberSince?.slice(0, 4) || 'PRAXIS'}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
          Your Goal Tree
        </Typography>
      </Box>

      {/* Vertical connecting line from trunk */}
      <Box sx={{ 
        position: 'relative', 
        width: 2, 
        height: 40, 
        mx: 'auto', 
        mb: 4,
        background: 'linear-gradient(180deg, #F59E0B 0%, rgba(245,158,11,0.3) 100%)',
        borderRadius: '2px',
      }} />

      {/* Domain Sections */}
      <Stack spacing={4}>
        {ALL_DOMAINS.map((domain) => {
          const domainGoals = goalsByDomain.get(domain) || [];
          const isActive = domainGoals.length > 0;
          const proficiency = domainProficiency[domain] ?? 0;
          const color = DOMAIN_COLORS[domain] || '#9CA3AF';
          const icon = DOMAIN_ICONS[domain] || '';

          return (
            <Box key={domain} sx={{ position: 'relative' }}>
              {/* Horizontal connector line */}
              <Box sx={{
                position: 'absolute',
                left: '50%',
                top: -20,
                width: 2,
                height: 20,
                background: isActive 
                  ? `linear-gradient(180deg, ${color} 0%, ${color}66 100%)`
                  : 'linear-gradient(180deg, rgba(156,163,175,0.5) 0%, rgba(156,163,175,0.2) 100%)',
                borderRadius: '2px',
                transform: 'translateX(-50%)',
              }} />

              {/* Domain Card */}
              <Paper
                elevation={0}
                sx={{
                  mx: 'auto',
                  maxWidth: 600,
                  px: 3, py: 2,
                  borderRadius: '16px',
                  background: isActive
                    ? `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: isActive ? color : 'rgba(255,255,255,0.15)',
                    transform: 'translateY(-2px)',
                  },
                  opacity: isActive ? 1 : 0.5,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  {/* Domain Icon */}
                  <Box sx={{
                    width: 48, height: 48,
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
                    border: `1px solid ${color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>
                    {icon}
                  </Box>

                  {/* Domain Info */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isActive ? 'text.primary' : 'text.disabled' }}>
                      {DOMAIN_SHORT[domain] || domain}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        {domainGoals.length} goal{domainGoals.length !== 1 ? 's' : ''}
                      </Typography>
                      {isActive && (
                        <>
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>•</Typography>
                          <Typography variant="caption" sx={{ color, fontWeight: 700, fontSize: '0.7rem' }}>
                            {proficiency.toFixed(1)}% proficiency
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </Box>

                  {/* Proficiency Ring */}
                  {isActive && (
                    <Box sx={{ position: 'relative', width: 40, height: 40 }}>
                      <svg width="40" height="40">
                        <circle
                          cx="20" cy="20" r="16"
                          fill="none" stroke={`${color}20`} strokeWidth="3"
                        />
                        <circle
                          cx="20" cy="20" r="16"
                          fill="none" stroke={color} strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${(proficiency / 100) * 100.53} 100.53`}
                          transform="rotate(-90 20 20)"
                        />
                      </svg>
                      <Typography sx={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '0.6rem', fontWeight: 800, color,
                      }}>
                        {Math.round(proficiency)}%
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>

              {/* Goal Cards for this domain */}
              {domainGoals.length > 0 && (
                <Box sx={{ mt: 2, ml: 4, pl: 3, borderLeft: `2px solid ${color}30` }}>
                  <Stack spacing={2}>
                    {domainGoals.map((goal) => {
                      const progress = goal.progress ?? 0;
                      const isComplete = progress >= 100;
                      
                      return (
                        <Paper
                          key={goal.id}
                          elevation={0}
                          onClick={() => onNodeClick?.(goal)}
                          sx={{
                            px: 2.5, py: 2,
                            borderRadius: '12px',
                            background: isComplete
                              ? `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`
                              : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isComplete ? color : 'rgba(255,255,255,0.08)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              background: isComplete
                                ? `linear-gradient(135deg, ${color}25 0%, ${color}15 100%)`
                                : 'rgba(255,255,255,0.05)',
                              borderColor: color,
                              transform: 'translateX(4px)',
                            },
                            position: 'relative',
                          }}
                        >
                          {/* Connection dot */}
                          <Box sx={{
                            position: 'absolute',
                            left: -21,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 10, height: 10,
                            borderRadius: '50%',
                            background: isComplete ? color : `${color}60`,
                            border: `2px solid ${color}30`,
                            boxShadow: isComplete ? `0 0 10px ${color}` : 'none',
                          }} />

                          <Stack spacing={1.5}>
                            {/* Goal Header */}
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Box sx={{
                                width: 32, height: 32,
                                borderRadius: '8px',
                                background: `linear-gradient(135deg, ${color}30 0%, ${color}15 100%)`,
                                border: `1px solid ${color}40`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16,
                              }}>
                                {icon}
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                  {goal.name}
                                </Typography>
                                {goal.description && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
                                    {goal.description.slice(0, 80)}{goal.description.length > 80 ? '...' : ''}
                                  </Typography>
                                )}
                              </Box>
                              <Typography sx={{ 
                                fontSize: '0.9rem', 
                                fontWeight: 800, 
                                color: isComplete ? color : 'text.secondary',
                                minWidth: 45,
                                textAlign: 'right',
                              }}>
                                {progress}%
                              </Typography>
                            </Stack>

                            {/* Progress Bar */}
                            <Box sx={{
                              width: '100%',
                              height: 6,
                              borderRadius: '3px',
                              background: 'rgba(255,255,255,0.06)',
                              overflow: 'hidden',
                            }}>
                              <Box sx={{
                                width: `${progress}%`,
                                height: '100%',
                                background: isComplete
                                  ? `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`
                                  : `linear-gradient(90deg, ${color}CC 0%, ${color} 100%)`,
                                borderRadius: '3px',
                                transition: 'width 0.5s ease',
                              }} />
                            </Box>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>

      {/* Empty State */}
      {rootNodes.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography sx={{ fontSize: 48, mb: 2, opacity: 0.3 }}>🌱</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.secondary' }}>
            Plant your first goal
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
            Your goal tree is waiting to grow
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default GoalTreeTimeline;
