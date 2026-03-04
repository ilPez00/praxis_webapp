/**
 * GoalTreeVisualization — SVG bottom-up tree, redesigned.
 *
 * Visual enhancements:
 *  - Dot-grid background pattern
 *  - Gradient branch strokes (parent → child color)
 *  - Radial gradient node fills per domain color
 *  - Domain emoji icon + % inside root-level nodes
 *  - Pill <rect> backgrounds behind node labels
 *  - Pulsing glow ring on 100%-complete nodes
 *  - Near-done ambient glow ring (≥75%)
 *  - Hover: color highlight + stroke brighten
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Box } from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';

// ── Layout constants ──────────────────────────────────────────────────────────

const LEVEL_GAP = 145;
const MIN_LEAF_W = 115;
const STEM_H = 55;
const ROOT_R = 22;
const R0 = 28;
const R1 = 20;
const R2 = 14;

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

// ── Layout algorithm ──────────────────────────────────────────────────────────

function leafCount(node: GoalNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((s, c) => s + leafCount(c), 0);
}

function buildNode(node: GoalNode, cx: number, cy: number, color: string, depth: number): LayoutNode {
  const r = depth === 0 ? R0 : depth === 1 ? R1 : R2;
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

function layoutForest(rootNodes: GoalNode[], svgW: number, baseY: number): LayoutNode[] {
  if (rootNodes.length === 0) return [];
  const totalLeaves = rootNodes.reduce((s, n) => s + leafCount(n), 0);
  const totalW = Math.max(totalLeaves * MIN_LEAF_W, svgW - 80);
  const firstY = baseY - STEM_H - LEVEL_GAP;
  let offsetX = (svgW - totalW) / 2;
  return rootNodes.map((node) => {
    const leaves = leafCount(node);
    const cx = offsetX + (leaves * MIN_LEAF_W) / 2;
    offsetX += leaves * MIN_LEAF_W;
    const color = DOMAIN_COLORS[node.domain || ''] || '#9CA3AF';
    return buildNode(node, cx, firstY, color, 0);
  });
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cp1y = y1 - (y1 - y2) * 0.42;
  const cp2y = y1 - (y1 - y2) * 0.58;
  return `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;
}

function alphaHex(a: number): string {
  return Math.round(Math.max(0, Math.min(255, a))).toString(16).padStart(2, '0');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  rootNodes: GoalNode[];
  memberSince?: string;
  onNodeClick?: (node: GoalNode) => void;
}

const GoalTreeVisualization: React.FC<Props> = ({ rootNodes, memberSince, onNodeClick }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const { svgW, svgH, layout, rootCX, rootCY } = useMemo(() => {
    const totalLeaves = rootNodes.reduce((s, n) => s + leafCount(n), 0);
    const minW = Math.max(600, totalLeaves * MIN_LEAF_W + 100);
    function maxDepth(node: GoalNode, d = 0): number {
      if (!node.children || node.children.length === 0) return d;
      return Math.max(...node.children.map((c) => maxDepth(c, d + 1)));
    }
    const depth = rootNodes.length > 0 ? Math.max(...rootNodes.map((n) => maxDepth(n))) + 1 : 1;
    const h = Math.max(520, (depth + 1) * LEVEL_GAP + STEM_H + 130);
    const cx = minW / 2;
    const cy = h - 60;
    return { svgW: minW, svgH: h, layout: layoutForest(rootNodes, minW, cy), rootCX: cx, rootCY: cy };
  }, [rootNodes]);

  // ── Flatten visible nodes + collect edges ──────────────────────────────────
  const flatNodes: LayoutNode[] = [];
  const edges: Array<{ from: LayoutNode; to: LayoutNode }> = [];

  function collect(node: LayoutNode) {
    flatNodes.push(node);
    if (!collapsed.has(node.node.id)) {
      for (const child of node.children) {
        edges.push({ from: node, to: child });
        collect(child);
      }
    }
  }
  layout.forEach(collect);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const stemTopY = layout.length > 0 ? layout[0].y + layout[0].r + 6 : rootCY - STEM_H;
  const rootLevelXs = layout.map((n) => n.x);
  const dateLabel = memberSince
    ? new Date(memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  // Unique domain colors for radial gradients
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

          {/* Radial gradient per domain color */}
          {uniqueColors.map((color) => (
            <radialGradient key={color} id={`gtv-rg-${color.replace('#', '')}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor={color} stopOpacity="0.85" />
              <stop offset="100%" stopColor={color} stopOpacity="0.18" />
            </radialGradient>
          ))}

          {/* Linear gradient per branch */}
          {edges.map(({ from, to }) => (
            <linearGradient
              key={`lg-${from.node.id}-${to.node.id}`}
              id={`gtv-lg-${from.node.id}-${to.node.id}`}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={from.color} stopOpacity="0.65" />
              <stop offset="100%" stopColor={to.color} stopOpacity="0.3" />
            </linearGradient>
          ))}

          {/* Soft glow */}
          <filter id="gtv-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Strong glow for complete nodes */}
          <filter id="gtv-glow-strong" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Pulse animation for complete nodes */}
        <style>{`
          @keyframes gtv-pulse {
            0%, 100% { opacity: 0.35; r: ${0}; }
            50% { opacity: 0.75; }
          }
          .gtv-pulse { animation: gtv-pulse 2.4s ease-in-out infinite; }
          .gtv-pulse-a { animation: gtv-pulse 2.4s ease-in-out infinite; }
          .gtv-pulse-b { animation: gtv-pulse 2.4s ease-in-out 1.2s infinite; }
        `}</style>

        {/* Background dot grid */}
        <rect width={svgW} height={svgH} fill="url(#gtv-dots)" />

        {/* ── Trunk ─────────────────────────────────────────────────────────── */}
        {layout.length > 0 && (
          <line
            x1={rootCX} y1={rootCY - ROOT_R}
            x2={rootCX} y2={stemTopY}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="5 6"
          />
        )}

        {/* Horizontal connector across root-level nodes */}
        {layout.length > 1 && (
          <line
            x1={Math.min(...rootLevelXs)} y1={stemTopY}
            x2={Math.max(...rootLevelXs)} y2={stemTopY}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={2}
          />
        )}

        {/* Vertical stubs from stem to root-level nodes */}
        {layout.length > 1 && layout.map((n) => (
          <line
            key={`stem-${n.node.id}`}
            x1={n.x} y1={stemTopY}
            x2={n.x} y2={n.y + n.r + 2}
            stroke={n.color}
            strokeWidth={2.5}
            strokeOpacity={0.5}
          />
        ))}

        {/* ── Gradient branches ─────────────────────────────────────────────── */}
        {edges.map(({ from, to }) => (
          <path
            key={`${from.node.id}-${to.node.id}`}
            d={bezier(from.x, from.y + from.r, to.x, to.y - to.r)}
            stroke={`url(#gtv-lg-${from.node.id}-${to.node.id})`}
            strokeWidth={from.depth === 0 ? 2.5 : from.depth === 1 ? 2 : 1.5}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* ── Root circle (origin) ───────────────────────────────────────────── */}
        <circle
          cx={rootCX} cy={rootCY} r={ROOT_R + 4}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={6}
        />
        <circle
          cx={rootCX} cy={rootCY} r={ROOT_R}
          fill="rgba(8,9,18,0.96)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1.5}
        />
        <circle cx={rootCX} cy={rootCY} r={5} fill="rgba(255,255,255,0.5)" />

        {dateLabel && (
          <>
            <rect
              x={rootCX - 30} y={rootCY + ROOT_R + 6}
              width={60} height={15}
              rx={7.5}
              fill="rgba(0,0,0,0.45)"
            />
            <text
              x={rootCX} y={rootCY + ROOT_R + 16}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.5)"
              fontFamily="inherit"
            >
              {dateLabel}
            </text>
          </>
        )}

        {/* ── Goal nodes ──────────────────────────────────────────────────────── */}
        {flatNodes.map((ln) => {
          const isHov = hovered === ln.node.id;
          const hasKids = ln.children.length > 0;
          const isCollapsed = collapsed.has(ln.node.id);
          const prog = ln.node.progress / 100;
          const circ = 2 * Math.PI * ln.r;
          const filledArc = prog * circ;
          const isDone = prog >= 1;
          const isNearDone = prog >= 0.75 && !isDone;
          const gradId = `gtv-rg-${ln.color.replace('#', '')}`;

          const icon = ln.depth === 0 ? (DOMAIN_ICONS[ln.node.domain || ''] || '') : '';
          const rawTitle = ln.node.title ?? '';
          const maxChars = ln.depth === 0 ? 20 : 16;
          const label = rawTitle.length > maxChars ? rawTitle.slice(0, maxChars - 1) + '…' : rawTitle;

          const labelFs = ln.depth === 0 ? 11 : 10;
          const labelY = ln.y + ln.r + (ln.depth === 0 ? 18 : 14);
          const pillW = label.length * labelFs * 0.58 + 14;
          const strokeW = isHov ? 2.8 : ln.depth === 0 ? 2 : 1.5;
          const strokeOpacity = isDone ? 1 : isHov ? 0.9 : 0.55;

          // Subtle fill opacity for empty nodes
          const fillAlpha = Math.round(prog * 180 + 15);
          const plainFill = prog === 0 ? `${ln.color}${alphaHex(15)}` : undefined;

          return (
            <g
              key={ln.node.id}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (onNodeClick) onNodeClick(ln.node);
                else if (hasKids) toggle(ln.node.id);
              }}
              onMouseEnter={() => setHovered(ln.node.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Pulsing outer ring for 100% nodes */}
              {isDone && (
                <>
                  <circle
                    cx={ln.x} cy={ln.y}
                    r={ln.r + 11}
                    fill="none"
                    stroke={ln.color}
                    strokeWidth={1.5}
                    className="gtv-pulse-a"
                    filter="url(#gtv-glow-strong)"
                  />
                  <circle
                    cx={ln.x} cy={ln.y}
                    r={ln.r + 6}
                    fill="none"
                    stroke={ln.color}
                    strokeWidth={1}
                    className="gtv-pulse-b"
                  />
                </>
              )}

              {/* Ambient glow ring for near-done */}
              {isNearDone && (
                <circle
                  cx={ln.x} cy={ln.y}
                  r={ln.r + 6}
                  fill="none"
                  stroke={ln.color}
                  strokeWidth={1.2}
                  strokeOpacity={0.22}
                  filter="url(#gtv-glow)"
                />
              )}

              {/* Hover halo */}
              {isHov && (
                <circle
                  cx={ln.x} cy={ln.y}
                  r={ln.r + 4}
                  fill="none"
                  stroke={ln.color}
                  strokeWidth={1}
                  strokeOpacity={0.35}
                />
              )}

              {/* Main circle — radial gradient fill */}
              <circle
                cx={ln.x} cy={ln.y} r={ln.r}
                fill={prog === 0 ? plainFill! : `url(#${gradId})`}
                stroke={ln.color}
                strokeWidth={strokeW}
                strokeOpacity={strokeOpacity}
              />

              {/* Progress arc overlay */}
              {prog > 0 && prog < 1 && (
                <circle
                  cx={ln.x} cy={ln.y} r={ln.r}
                  fill="none"
                  stroke={ln.color}
                  strokeWidth={ln.depth === 0 ? 4 : 3}
                  strokeDasharray={`${filledArc} ${circ}`}
                  strokeLinecap="round"
                  opacity={0.9}
                  transform={`rotate(-90 ${ln.x} ${ln.y})`}
                />
              )}

              {/* Done — full bright ring */}
              {isDone && (
                <circle
                  cx={ln.x} cy={ln.y} r={ln.r}
                  fill="none"
                  stroke={ln.color}
                  strokeWidth={ln.depth === 0 ? 4 : 3}
                  filter="url(#gtv-glow)"
                />
              )}

              {/* Root node: icon + % */}
              {ln.depth === 0 && (
                <>
                  {icon && (
                    <text
                      x={ln.x} y={ln.y - 6}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="14"
                      fontFamily="inherit"
                    >
                      {icon}
                    </text>
                  )}
                  <text
                    x={ln.x} y={icon ? ln.y + 10 : ln.y + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="8" fontWeight="700"
                    fill={isDone ? ln.color : `${ln.color}CC`}
                    fontFamily="inherit"
                  >
                    {ln.node.progress}%
                  </text>
                </>
              )}

              {/* Sub-node progress */}
              {ln.depth > 0 && prog > 0 && (
                <text
                  x={ln.x} y={ln.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="8" fontWeight="600"
                  fill={`${ln.color}DD`}
                  fontFamily="inherit"
                >
                  {ln.node.progress}%
                </text>
              )}

              {/* Collapse/expand indicator */}
              {hasKids && (
                <text
                  x={ln.x + ln.r - 1} y={ln.y - ln.r + 3}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="10"
                  fill="rgba(255,255,255,0.65)"
                  fontFamily="inherit"
                >
                  {isCollapsed ? '+' : '−'}
                </text>
              )}

              {/* Label pill */}
              <rect
                x={ln.x - pillW / 2}
                y={labelY - labelFs + 1}
                width={pillW}
                height={labelFs + 5}
                rx={4}
                fill="rgba(6,7,16,0.6)"
              />
              <text
                x={ln.x}
                y={labelY}
                textAnchor="middle"
                fontSize={`${labelFs}`}
                fontWeight={ln.depth === 0 ? '600' : '400'}
                fill={isHov ? ln.color : `rgba(255,255,255,${ln.depth === 0 ? 0.9 : 0.7})`}
                fontFamily="inherit"
              >
                {label}
              </text>

              {/* Sub-node progress text below label */}
              {ln.depth > 0 && prog === 0 && (
                <text
                  x={ln.x}
                  y={labelY + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill={`${ln.color}77`}
                  fontFamily="inherit"
                >
                  0%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Box>
  );
};

export default GoalTreeVisualization;
