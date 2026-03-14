/**
 * GoalTreeRadial — Radial/circular mind-map style visualization.
 * 
 * Design:
 *  - Trunk at center with gradient glow
 *  - Domains radiate outward in a circle
 *  - Goals branch from their domain nodes
 *  - Smooth bezier curves connecting nodes
 *  - Progress rings around goal nodes
 *  - Domain color coding with gradients
 */

import React, { useMemo } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';
import { Domain } from '../../../models/Domain';

const ALL_DOMAINS = Object.values(Domain);

const DOMAIN_SHORT: Record<string, string> = {
  [Domain.CAREER]: 'Career',
  [Domain.INVESTING]: 'Finance',
  [Domain.FITNESS]: 'Fitness',
  [Domain.ACADEMICS]: 'Academics',
  [Domain.MENTAL_HEALTH]: 'Mental',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: 'Philosophy',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: 'Creative',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: 'Intimacy',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: 'Social',
  [Domain.PERSONAL_GOALS]: 'Personal',
};

interface Props {
  rootNodes: GoalNode[];
  domainProficiency?: Record<string, number>;
  memberSince?: string;
  onNodeClick?: (node: GoalNode) => void;
  onRootClick?: () => void;
}

const GoalTreeRadial: React.FC<Props> = ({
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

  const activeDomains = ALL_DOMAINS.filter(d => (goalsByDomain.get(d)?.length || 0) > 0);
  const inactiveDomains = ALL_DOMAINS.filter(d => (goalsByDomain.get(d)?.length || 0) === 0);

  // Calculate angles for radial layout
  const totalDomains = ALL_DOMAINS.length;
  const angleStep = 360 / totalDomains;

  return (
    <Box sx={{ 
      position: 'relative',
      width: '100%', 
      minHeight: '700px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, rgba(10,11,20,0.95) 0%, rgba(17,24,39,0.98) 100%)',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <svg width="100%" height="700" viewBox="0 0 800 700">
        <defs>
          {/* Trunk gradient */}
          <radialGradient id="trunk-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.2" />
          </radialGradient>
          
          {/* Glow filters */}
          <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="15" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Center Trunk */}
        <g 
          transform="translate(400, 350)" 
          onClick={onRootClick}
          style={{ cursor: onRootClick ? 'pointer' : 'default' }}
        >
          {/* Outer glow rings */}
          <circle r="80" fill="none" stroke="#F59E0B" strokeWidth="1" opacity="0.1">
            <animate attributeName="r" values="60;80;60" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.05;0.2" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle r="60" fill="none" stroke="#F59E0B" strokeWidth="1" opacity="0.15">
            <animate attributeName="r" values="45;60;45" dur="3s" repeatCount="indefinite" begin="1s" />
            <animate attributeName="opacity" values="0.3;0.08;0.3" dur="3s" repeatCount="indefinite" begin="1s" />
          </circle>
          
          {/* Main trunk circle */}
          <circle 
            r="45" 
            fill="url(#trunk-grad)" 
            stroke="#F59E0B" 
            strokeWidth="2"
            filter="url(#glow-soft)"
          />
          
          {/* Inner content */}
          <text y="-8" textAnchor="middle" fontSize="28">🌳</text>
          <text y="15" textAnchor="middle" fontSize="10" fontWeight="800" fill="#F59E0B">
            {memberSince?.slice(0, 4) || 'PRAXIS'}
          </text>
        </g>

        {/* Domain nodes in radial arrangement */}
        {ALL_DOMAINS.map((domain, index) => {
          const angle = (index * angleStep - 90) * (Math.PI / 180);
          const radius = 180;
          const x = 400 + Math.cos(angle) * radius;
          const y = 350 + Math.sin(angle) * radius;
          
          const domainGoals = goalsByDomain.get(domain) || [];
          const isActive = domainGoals.length > 0;
          const proficiency = domainProficiency[domain] ?? 0;
          const color = DOMAIN_COLORS[domain] || '#9CA3AF';
          const icon = DOMAIN_ICONS[domain] || '';
          
          // Connection line from trunk
          const lineEndX = 400 + Math.cos(angle) * 35;
          const lineEndY = 350 + Math.sin(angle) * 35;
          
          return (
            <g key={domain}>
              {/* Connection line */}
              <line
                x1={400 + Math.cos(angle) * 45}
                y1={350 + Math.sin(angle) * 45}
                x2={x - Math.cos(angle) * 25}
                y2={y - Math.sin(angle) * 25}
                stroke={isActive ? color : '#4B5563'}
                strokeWidth={isActive ? 2 : 1}
                strokeOpacity={isActive ? 0.6 : 0.3}
                strokeDasharray={isActive ? 'none' : '4,4'}
              />
              
              {/* Domain node group */}
              <g transform={`translate(${x}, ${y})`}>
                {/* Active domain glow */}
                {isActive && (
                  <circle r="35" fill={color} opacity="0.15" filter="url(#glow-soft)">
                    <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                
                {/* Proficiency ring */}
                {isActive && (
                  <circle
                    r="24"
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeOpacity="0.2"
                  />
                )}
                {isActive && (
                  <circle
                    r="24"
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(proficiency / 100) * 150.8} 150.8`}
                    transform="rotate(-90)"
                  />
                )}
                
                {/* Main domain circle */}
                <circle
                  r="22"
                  fill={isActive ? `${color}20` : '#1F2937'}
                  stroke={isActive ? color : '#4B5563'}
                  strokeWidth={isActive ? 2 : 1}
                  strokeOpacity={isActive ? 0.8 : 0.4}
                  style={{
                    cursor: isActive ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => isActive && onRootClick?.()}
                />
                
                {/* Domain icon */}
                <text 
                  y="2" 
                  textAnchor="middle" 
                  fontSize="14"
                  style={{ pointerEvents: 'none' }}
                >
                  {icon}
                </text>
                
                {/* Domain label */}
                <text
                  y="40"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight={isActive ? 700 : 400}
                  fill={isActive ? '#E5E7EB' : '#6B7280'}
                  style={{ pointerEvents: 'none' }}
                >
                  {DOMAIN_SHORT[domain] || domain}
                </text>
                
                {/* Goal count badge */}
                {isActive && domainGoals.length > 0 && (
                  <g transform="translate(18, -18)">
                    <circle r="9" fill={color} />
                    <text 
                      y="3" 
                      textAnchor="middle" 
                      fontSize="9" 
                      fontWeight="800" 
                      fill="#0A0B14"
                    >
                      {domainGoals.length}
                    </text>
                  </g>
                )}
              </g>
              
              {/* Goal nodes branching from domain */}
              {isActive && domainGoals.map((goal, goalIndex) => {
                const goalAngle = angle + (goalIndex - (domainGoals.length - 1) / 2) * 0.15;
                const goalRadius = 280;
                const goalX = 400 + Math.cos(goalAngle) * goalRadius;
                const goalY = 350 + Math.sin(goalAngle) * goalRadius;
                const progress = goal.progress ?? 0;
                const isComplete = progress >= 100;
                
                return (
                  <g key={goal.id}>
                    {/* Connection line from domain */}
                    <path
                      d={`M ${x - Math.cos(angle) * 25} ${y - Math.sin(angle) * 25} 
                         Q ${400 + Math.cos(goalAngle) * 220} ${350 + Math.sin(goalAngle) * 220}
                           ${goalX - Math.cos(goalAngle) * 20} ${goalY - Math.sin(goalAngle) * 20}`}
                      fill="none"
                      stroke={isComplete ? color : `${color}60`}
                      strokeWidth={1.5}
                      strokeOpacity={0.4}
                    />
                    
                    {/* Goal node */}
                    <g 
                      transform={`translate(${goalX}, ${goalY})`}
                      onClick={() => onNodeClick?.(goal)}
                      style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
                    >
                      {/* Progress ring */}
                      {progress > 0 && (
                        <circle
                          r="18"
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          strokeOpacity="0.2"
                        />
                      )}
                      {progress > 0 && progress < 100 && (
                        <circle
                          r="18"
                          fill="none"
                          stroke={color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray={`${(progress / 100) * 113.1} 113.1`}
                          transform="rotate(-90)"
                        />
                      )}
                      {isComplete && (
                        <circle r="18" fill={color} opacity="0.2" filter="url(#glow-strong)" />
                      )}
                      
                      {/* Goal circle */}
                      <circle
                        r="16"
                        fill={isComplete ? `${color}30` : '#111827'}
                        stroke={color}
                        strokeWidth={isComplete ? 2 : 1.5}
                        strokeOpacity={isComplete ? 1 : 0.7}
                      />
                      
                      {/* Progress percentage */}
                      {progress > 0 && (
                        <text
                          y="3"
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="700"
                          fill={isComplete ? '#0A0B14' : color}
                        >
                          {progress}%
                        </text>
                      )}
                      
                      {/* Goal label */}
                      <text
                        y={progress > 0 ? "32" : "30"}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="600"
                        fill="#E5E7EB"
                        style={{ 
                          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                          pointerEvents: 'none',
                        }}
                      >
                        {goal.name.length > 18 ? goal.name.slice(0, 17) + '…' : goal.name}
                      </text>
                      
                      {/* Complete badge */}
                      {isComplete && (
                        <text y="3" textAnchor="middle" fontSize="12">✓</text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      
      {/* Legend */}
      <Box sx={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 3,
        px: 3,
        py: 1.5,
        borderRadius: '12px',
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Trunk</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(16,185,129,0.6)', border: '1.5px solid #10B981' }} />
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Domain</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(59,130,246,0.3)', border: '1.5px solid #3B82F6' }} />
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Goal</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(16,185,129,0.3)', border: '2px solid #10B981' }} />
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Complete</Typography>
        </Stack>
      </Box>
    </Box>
  );
};

export default GoalTreeRadial;
