/**
 * GoalTreeVisualization — always shows all 10 Praxis domains.
 *
 * Design rules:
 *  - All 10 domain nodes rendered at root level, always visible
 *  - Active domains (user has goals set) → breathing glow halo behind the node
 *  - Inactive domains → same node at 30% opacity, no glow
 *  - Each domain node shows: emoji + proficiency % (from domain_proficiency)
 *  - Goal sub-nodes sit below their domain; progress arc + % inside
 *  - 100%-complete nodes → pulsing ring; ≥75% → ambient ring
 *  - No collapse/expand — entire tree always expanded
 */

import React, { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';
import { Domain } from '../../../models/Domain';

const ALL_DOMAINS = Object.values(Domain);

// Short labels for domain nodes (full names are too long for SVG)
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

// ── Layout constants ──────────────────────────────────────────────────────────

const LEVEL_GAP = 130;
const MIN_LEAF_W = 105;
const STEM_H = 45;
const ROOT_R = 20;   // trunk origin circle
const R_DOM = 30;    // domain node
const R1 = 20;       // depth-1 (user goal)
const R2 = 14;       // depth-2 (sub-goal)
const R3 = 10;       // depth-3+

// ── Layout types ──────────────────────────────────────────────────────────────

interface LayoutNode {
  node: GoalNode;
  x: number;
  y: number;
  color: string;
  r: number;
  depth: number;
  children: LayoutNode[];
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function leafCount(node: GoalNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((s, c) => s + leafCount(c), 0);
}

function nodeRadius(depth: number): number {
  if (depth === 0) return R_DOM;
  if (depth === 1) return R1;
  if (depth === 2) return R2;
  return R3;
}

function buildNode(node: GoalNode, cx: number, cy: number, color: string, depth: number): LayoutNode {
  const r = nodeRadius(depth);
  const childY = cy - LEVEL_GAP;
  let children: LayoutNode[] = [];
  if (node.children && node.children.length > 0) {
    const totalLeaves = node.children.reduce((s, c) => s + leafCount(c), 0);
    let offsetX = cx - (totalLeaves * MIN_LEAF_W) / 2;
    children = node.children.map((child) => {
      const leaves = leafCount(child);
      const childCx = offsetX + (leaves * MIN_LEAF_W) / 2;
      offsetX += leaves * MIN_LEAF_W;
      return buildNode(child, childCx, childY, color, depth + 1);
    });
  }
  return { node, x: cx, y: cy, color, r, depth, children };
}

function layoutForest(domainRoots: GoalNode[], svgW: number, baseY: number): LayoutNode[] {
  if (domainRoots.length === 0) return [];
  const totalLeaves = domainRoots.reduce((s, n) => s + leafCount(n), 0);
  const totalW = Math.max(totalLeaves * MIN_LEAF_W, svgW - 40);
  const firstY = baseY - STEM_H - LEVEL_GAP;
  let offsetX = (svgW - totalW) / 2;
  return domainRoots.map((node) => {
    const leaves = leafCount(node);
    const cx = offsetX + (leaves * MIN_LEAF_W) / 2;
    offsetX += leaves * MIN_LEAF_W;
    const color = DOMAIN_COLORS[node.domain || ''] || '#9CA3AF';
    return buildNode(node, cx, firstY, color, 0);
  });
}

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cp1y = y1 - (y1 - y2) * 0.42;
  const cp2y = y1 - (y1 - y2) * 0.58;
  return `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;
}

// sanitize SVG id (no spaces, special chars)
function safeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, '_');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  rootNodes: GoalNode[];
  domainProficiency?: Record<string, number>;
  memberSince?: string;
  onNodeClick?: (node: GoalNode) => void;
}

const GoalTreeVisualization: React.FC<Props> = ({
  rootNodes,
  domainProficiency = {},
  memberSince,
  onNodeClick,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);

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

  // 10 synthetic domain nodes — always all rendered
  const allDomainRoots = useMemo<GoalNode[]>(() =>
    ALL_DOMAINS.map((domain) => ({
      id: `__dom__${domain}`,
      title: domain,
      weight: 1,
      progress: 0,
      domain: domain as Domain,
      children: goalsByDomain.get(domain) || [],
    })),
    [goalsByDomain]
  );

  const { svgW, svgH, layout, rootCX, rootCY } = useMemo(() => {
    const totalLeaves = allDomainRoots.reduce((s, n) => s + leafCount(n), 0);
    const minW = Math.max(900, totalLeaves * MIN_LEAF_W + 80);

    function maxDepth(node: GoalNode, d = 0): number {
      if (!node.children || node.children.length === 0) return d;
      return Math.max(...node.children.map((c) => maxDepth(c, d + 1)));
    }
    const depth = Math.max(...allDomainRoots.map((n) => maxDepth(n))) + 1;
    const h = Math.max(520, (depth + 1) * LEVEL_GAP + STEM_H + 130);
    const cx = minW / 2;
    const cy = h - 58;
    return {
      svgW: minW,
      svgH: h,
      layout: layoutForest(allDomainRoots, minW, cy),
      rootCX: cx,
      rootCY: cy,
    };
  }, [allDomainRoots]);

  // Flatten all nodes + collect edges (no collapse — always fully visible)
  const flatNodes: LayoutNode[] = [];
  const edges: Array<{ from: LayoutNode; to: LayoutNode }> = [];

  function collect(ln: LayoutNode) {
    flatNodes.push(ln);
    for (const child of ln.children) {
      edges.push({ from: ln, to: child });
      collect(child);
    }
  }
  layout.forEach(collect);

  const stemTopY = layout.length > 0 ? layout[0].y + layout[0].r + 6 : rootCY - STEM_H;
  const rootLevelXs = layout.map((n) => n.x);
  const dateLabel = memberSince
    ? new Date(memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  const uniqueColors = Array.from(new Set(flatNodes.map((n) => n.color)));

  return (
    <Box sx={{ overflowX: 'auto', py: 2, display: 'flex', justifyContent: 'center' }}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block' }}
      >
        <defs>
          {/* Dot grid background */}
          <pattern id="gtv-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.055)" />
          </pattern>

          {/* Radial gradient fills per domain color */}
          {uniqueColors.map((color) => (
            <radialGradient key={color} id={`gtv-rg-${safeId(color)}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor={color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={color} stopOpacity="0.2" />
            </radialGradient>
          ))}

          {/* Linear gradient per branch */}
          {edges.map(({ from, to }) => (
            <linearGradient
              key={`lg-${safeId(from.node.id)}-${safeId(to.node.id)}`}
              id={`gtv-lg-${safeId(from.node.id)}-${safeId(to.node.id)}`}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={from.color} stopOpacity="0.55" />
              <stop offset="100%" stopColor={to.color} stopOpacity="0.25" />
            </linearGradient>
          ))}

          {/* Glow filters */}
          <filter id="gtv-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Background bloom — used for active domain halos */}
          <filter id="gtv-bloom" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="gtv-glow-strong" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style>{`
          @keyframes gtv-pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.75; }
          }
          .gtv-pulse-a { animation: gtv-pulse 2.4s ease-in-out infinite; }
          .gtv-pulse-b { animation: gtv-pulse 2.4s ease-in-out 1.2s infinite; }
          @keyframes gtv-breathe {
            0%, 100% { opacity: 0.18; }
            50% { opacity: 0.38; }
          }
          .gtv-active-glow { animation: gtv-breathe 3s ease-in-out infinite; }
        `}</style>

        {/* Background */}
        <rect width={svgW} height={svgH} fill="url(#gtv-dots)" />

        {/* Trunk (origin dot) */}
        <line
          x1={rootCX} y1={rootCY - ROOT_R}
          x2={rootCX} y2={stemTopY}
          stroke="rgba(255,255,255,0.13)"
          strokeWidth={2}
          strokeDasharray="5 6"
          strokeLinecap="round"
        />

        {/* Horizontal connector across domain nodes */}
        {layout.length > 1 && (
          <line
            x1={Math.min(...rootLevelXs)} y1={stemTopY}
            x2={Math.max(...rootLevelXs)} y2={stemTopY}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1.5}
          />
        )}

        {/* Vertical stubs: stem → domain nodes */}
        {layout.map((n) => {
          const isActive = n.node.children.length > 0;
          return (
            <line
              key={`stem-${n.node.id}`}
              x1={n.x} y1={stemTopY}
              x2={n.x} y2={n.y + n.r + 2}
              stroke={n.color}
              strokeWidth={2}
              strokeOpacity={isActive ? 0.45 : 0.12}
            />
          );
        })}

        {/* Gradient branches between goal nodes */}
        {edges.map(({ from, to }) => (
          <path
            key={`${safeId(from.node.id)}-${safeId(to.node.id)}`}
            d={bezier(from.x, from.y + from.r, to.x, to.y - to.r)}
            stroke={`url(#gtv-lg-${safeId(from.node.id)}-${safeId(to.node.id)})`}
            strokeWidth={from.depth === 0 ? 2 : from.depth === 1 ? 1.8 : 1.2}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* Origin circle */}
        <circle cx={rootCX} cy={rootCY} r={ROOT_R + 4} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle cx={rootCX} cy={rootCY} r={ROOT_R} fill="rgba(8,9,18,0.96)" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
        <circle cx={rootCX} cy={rootCY} r={4} fill="rgba(255,255,255,0.45)" />
        {dateLabel && (
          <>
            <rect x={rootCX - 30} y={rootCY + ROOT_R + 6} width={60} height={14} rx={7} fill="rgba(0,0,0,0.4)" />
            <text x={rootCX} y={rootCY + ROOT_R + 15} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,0.4)" fontFamily="inherit">
              {dateLabel}
            </text>
          </>
        )}

        {/* ── All nodes ─────────────────────────────────────────────────────── */}
        {flatNodes.map((ln) => {
          const isDomainNode = ln.depth === 0;
          const isActive = isDomainNode && ln.node.children.length > 0;
          const isInactive = isDomainNode && !isActive;
          const isHov = hovered === ln.node.id;

          const prog = isDomainNode ? 0 : ln.node.progress / 100;
          const circ = 2 * Math.PI * ln.r;
          const filledArc = prog * circ;
          const isDone = prog >= 1;
          const isNearDone = prog >= 0.75 && !isDone;

          const proficiency = isDomainNode
            ? (domainProficiency[ln.node.domain || ''] ?? 0)
            : 0;

          const gradId = `gtv-rg-${safeId(ln.color)}`;
          const icon = DOMAIN_ICONS[ln.node.domain || ''] || '';
          const shortDomain = DOMAIN_SHORT[ln.node.domain as Domain] || '';

          // Goal node label (depth >= 1)
          const rawTitle = ln.node.title ?? '';
          const maxChars = ln.depth === 1 ? 17 : 13;
          const label = rawTitle.length > maxChars ? rawTitle.slice(0, maxChars - 1) + '…' : rawTitle;
          const labelFs = ln.depth === 1 ? 10 : 9;
          const labelY = ln.y + ln.r + (ln.depth === 1 ? 15 : 12);
          const pillW = label.length * labelFs * 0.58 + 12;

          const isSuspended = ln.node.status === 'suspended';

          const strokeOpacity = isDomainNode
            ? (isActive ? 0.8 : 0.35)
            : (isDone ? 1 : isHov ? 0.9 : 0.6);

          return (
            <g
              key={ln.node.id}
              style={{
                cursor: onNodeClick ? 'pointer' : 'default',
                opacity: isSuspended ? 0.35 : isInactive ? 0.3 : 1,
                filter: isSuspended ? 'grayscale(0.8)' : undefined,
              }}
              onClick={() => onNodeClick ? onNodeClick(ln.node) : undefined}
              onMouseEnter={() => setHovered(ln.node.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Breathing glow bloom behind active domain nodes */}
              {isActive && (
                <circle
                  cx={ln.x} cy={ln.y}
                  r={ln.r + 24}
                  fill={ln.color}
                  filter="url(#gtv-bloom)"
                  className="gtv-active-glow"
                />
              )}

              {/* Pulsing rings for 100%-complete goal nodes */}
              {isDone && (
                <>
                  <circle cx={ln.x} cy={ln.y} r={ln.r + 11} fill="none" stroke={ln.color}
                    strokeWidth={1.5} className="gtv-pulse-a" filter="url(#gtv-glow-strong)" />
                  <circle cx={ln.x} cy={ln.y} r={ln.r + 6} fill="none" stroke={ln.color}
                    strokeWidth={1} className="gtv-pulse-b" />
                </>
              )}

              {/* Near-done ambient ring */}
              {isNearDone && (
                <circle cx={ln.x} cy={ln.y} r={ln.r + 5} fill="none" stroke={ln.color}
                  strokeWidth={1} strokeOpacity={0.2} filter="url(#gtv-glow)" />
              )}

              {/* Hover halo */}
              {isHov && (
                <circle cx={ln.x} cy={ln.y} r={ln.r + 4} fill="none" stroke={ln.color}
                  strokeWidth={1} strokeOpacity={0.35} />
              )}

              {/* Main circle */}
              <circle
                cx={ln.x} cy={ln.y} r={ln.r}
                fill={prog === 0 ? `${ln.color}15` : `url(#${gradId})`}
                stroke={ln.color}
                strokeWidth={isHov ? 2.5 : isDomainNode ? 2 : 1.5}
                strokeOpacity={strokeOpacity}
              />
              {/* Domain node: always use gradient to look richer */}
              {isDomainNode && (
                <circle
                  cx={ln.x} cy={ln.y} r={ln.r}
                  fill={`url(#${gradId})`}
                  stroke={ln.color}
                  strokeWidth={isHov ? 2.5 : 2}
                  strokeOpacity={strokeOpacity}
                />
              )}

              {/* Progress arc for goal nodes */}
              {!isDomainNode && prog > 0 && prog < 1 && (
                <circle
                  cx={ln.x} cy={ln.y} r={ln.r}
                  fill="none" stroke={ln.color}
                  strokeWidth={ln.depth === 1 ? 3.5 : 2.5}
                  strokeDasharray={`${filledArc} ${circ}`}
                  strokeLinecap="round" opacity={0.9}
                  transform={`rotate(-90 ${ln.x} ${ln.y})`}
                />
              )}

              {/* Full bright ring for done */}
              {isDone && (
                <circle cx={ln.x} cy={ln.y} r={ln.r} fill="none" stroke={ln.color}
                  strokeWidth={ln.depth === 1 ? 3.5 : 2.5} filter="url(#gtv-glow)" />
              )}

              {/* Domain node content: emoji + proficiency % */}
              {isDomainNode && (
                <>
                  {icon && (
                    <text x={ln.x} y={ln.y - 8} textAnchor="middle" dominantBaseline="middle"
                      fontSize="15" fontFamily="inherit">
                      {icon}
                    </text>
                  )}
                  <text x={ln.x} y={ln.y + 10} textAnchor="middle" dominantBaseline="middle"
                    fontSize="8" fontWeight="700"
                    fill={isActive ? ln.color : `${ln.color}99`}
                    fontFamily="inherit">
                    {proficiency.toFixed(2)}%
                  </text>
                  {/* Short domain label below circle */}
                  <text x={ln.x} y={ln.y + ln.r + 14} textAnchor="middle"
                    fontSize="9" fontWeight={isActive ? '700' : '400'}
                    fill={isActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.35)'}
                    fontFamily="inherit">
                    {shortDomain}
                  </text>
                </>
              )}

              {/* Goal node content: % + label */}
              {!isDomainNode && (
                <>
                  {prog > 0 && (
                    <text x={ln.x} y={ln.y} textAnchor="middle" dominantBaseline="middle"
                      fontSize="8" fontWeight="600" fill={`${ln.color}DD`} fontFamily="inherit">
                      {ln.node.progress}%
                    </text>
                  )}
                  {label && (
                    <>
                      <rect
                        x={ln.x - pillW / 2} y={labelY - labelFs + 1}
                        width={pillW} height={labelFs + 4} rx={3}
                        fill="rgba(6,7,16,0.6)"
                      />
                      <text x={ln.x} y={labelY} textAnchor="middle"
                        fontSize={`${labelFs}`}
                        fontWeight={ln.depth === 1 ? '600' : '400'}
                        fill={isHov ? ln.color : 'rgba(255,255,255,0.8)'}
                        fontFamily="inherit">
                        {label}
                      </text>
                    </>
                  )}
                  {isSuspended && (
                    <text x={ln.x} y={labelY + labelFs + 4} textAnchor="middle"
                      fontSize="10" fontFamily="inherit">
                      ⏸
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </Box>
  );
};

export default GoalTreeVisualization;
