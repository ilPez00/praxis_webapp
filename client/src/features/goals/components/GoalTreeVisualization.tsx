/**
 * GoalTreeVisualization — SVG bottom-up tree visualization.
 *
 * Layout rules (matching user spec):
 *  - Root circle (member-since date) sits at the bottom center.
 *  - A vertical stem rises from the root circle.
 *  - Each root-level goal = a colored branch spreading horizontally at LEVEL_GAP above root.
 *  - Sub-goals branch further UP (vertical), colored the same as their domain parent.
 *  - Sibling goals at the same level spread HORIZONTALLY.
 *  - Each node circle: stroke-only fill at low opacity when progress=0,
 *    fills with domain color opacity∝progress, full glow when 100%.
 *  - Click a node with children to collapse/expand.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { Box } from '@mui/material';
import { GoalNode, DOMAIN_COLORS } from '../../../types/goal';

// ── Layout constants ──────────────────────────────────────────────────────────

const LEVEL_GAP = 145;       // px between vertical levels
const MIN_LEAF_W = 115;      // horizontal space allocated per leaf node
const STEM_H = 55;           // height of trunk above root circle before first branch
const ROOT_R = 22;           // root circle radius
const R0 = 28;               // root-goal node radius
const R1 = 20;               // sub-goal radius
const R2 = 14;               // sub-sub-goal radius

// ── Layout types ─────────────────────────────────────────────────────────────

interface LayoutNode {
  node: GoalNode;
  x: number;
  y: number;
  color: string;
  r: number;
  depth: number;
  children: LayoutNode[];
}

// ── Layout algorithm ─────────────────────────────────────────────────────────

/** Count leaf descendants (a leaf = node with no children). */
function leafCount(node: GoalNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((s, c) => s + leafCount(c), 0);
}

function buildNode(
  node: GoalNode,
  cx: number,
  cy: number,
  color: string,
  depth: number,
): LayoutNode {
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
    const color = DOMAIN_COLORS[node.domain || 'defaultDomain'] || '#9CA3AF';
    return buildNode(node, cx, firstY, color, 0);
  });
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

/** Smooth cubic bezier from (x1,y1) to (x2,y2) pointing upward. */
function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const cp1y = y1 - (y1 - y2) * 0.42;
  const cp2y = y1 - (y1 - y2) * 0.58;
  return `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;
}

/** Convert 0-255 alpha to 2-char hex. */
function alphaHex(a: number): string {
  return Math.round(Math.max(0, Math.min(255, a))).toString(16).padStart(2, '0');
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  rootNodes: GoalNode[];
  memberSince?: string; // ISO date string — shown in root circle
  onNodeClick?: (node: GoalNode) => void; // optional: called when any goal node is clicked
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

  // ── Dimension computation ───────────────────────────────────────────────────
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
    return {
      svgW: minW,
      svgH: h,
      layout: layoutForest(rootNodes, minW, cy),
      rootCX: cx,
      rootCY: cy,
    };
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

  // ── Stem geometry ──────────────────────────────────────────────────────────
  const stemTopY =
    layout.length > 0 ? layout[0].y + layout[0].r + 6 : rootCY - STEM_H;
  const rootLevelXs = layout.map((n) => n.x);

  // ── Date label ─────────────────────────────────────────────────────────────
  const dateLabel = memberSince
    ? new Date(memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  return (
    <Box sx={{ overflowX: 'auto', py: 2, display: 'flex', justifyContent: 'center' }}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block' }}
      >
        <defs>
          <filter id="gtv-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Trunk (root → first branch level) ──────────────────────────── */}
        {layout.length > 0 && (
          <line
            x1={rootCX} y1={rootCY - ROOT_R}
            x2={rootCX} y2={stemTopY}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {/* Horizontal connector across root-level nodes when > 1 */}
        {layout.length > 1 && (
          <line
            x1={Math.min(...rootLevelXs)} y1={stemTopY}
            x2={Math.max(...rootLevelXs)} y2={stemTopY}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={2}
          />
        )}

        {/* Short vertical connectors from stem-top to each root-level node */}
        {layout.length > 1 &&
          layout.map((n) => (
            <line
              key={`stem-${n.node.id}`}
              x1={n.x} y1={stemTopY}
              x2={n.x} y2={n.y + n.r + 2}
              stroke={n.color}
              strokeWidth={2}
              strokeOpacity={0.35}
            />
          ))}

        {/* ── Branches between nodes ──────────────────────────────────────── */}
        {edges.map(({ from, to }) => (
          <path
            key={`${from.node.id}-${to.node.id}`}
            d={bezier(from.x, from.y + from.r, to.x, to.y - to.r)}
            stroke={from.color}
            strokeWidth={from.depth === 0 ? 2.5 : from.depth === 1 ? 2 : 1.5}
            strokeOpacity={0.5}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* ── Root circle (origin / registration date) ────────────────────── */}
        <circle
          cx={rootCX} cy={rootCY} r={ROOT_R}
          fill="rgba(10,11,20,0.9)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={2}
        />
        {/* Inner dot */}
        <circle cx={rootCX} cy={rootCY} r={5} fill="rgba(255,255,255,0.45)" />
        {dateLabel && (
          <text
            x={rootCX} y={rootCY + ROOT_R + 15}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.38)"
            fontFamily="inherit"
          >
            {dateLabel}
          </text>
        )}

        {/* ── Goal nodes ──────────────────────────────────────────────────── */}
        {flatNodes.map((ln) => {
          const isHov = hovered === ln.node.id;
          const hasKids = ln.children.length > 0;
          const isCollapsed = collapsed.has(ln.node.id);
          const prog = ln.node.progress / 100; // 0–1
          const circ = 2 * Math.PI * ln.r;
          const filledArc = prog * circ;

          // Fill color: domain color with alpha ∝ progress
          const fillAlpha = Math.round(prog * 180 + 15);
          const fillColor = `${ln.color}${alphaHex(fillAlpha)}`;

          // Truncate label
          const maxChars = ln.depth === 0 ? 20 : 16;
          const label =
            ln.node.title.length > maxChars
              ? ln.node.title.slice(0, maxChars - 1) + '…'
              : ln.node.title;

          const strokeW = isHov ? 2.5 : ln.depth === 0 ? 2 : 1.5;

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
              {/* Outer glow ring when near completion */}
              {prog >= 0.75 && (
                <circle
                  cx={ln.x} cy={ln.y} r={ln.r + 7}
                  fill="none"
                  stroke={ln.color}
                  strokeWidth={1}
                  strokeOpacity={0.2}
                  filter="url(#gtv-glow)"
                />
              )}

              {/* Background circle */}
              <circle
                cx={ln.x} cy={ln.y} r={ln.r}
                fill={fillColor}
                stroke={ln.color}
                strokeWidth={strokeW}
                strokeOpacity={prog >= 1 ? 1 : 0.5}
              />

              {/* Progress arc overlay (0 < progress < 100) */}
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

              {/* Completion checkmark circle (100%) */}
              {prog >= 1 && (
                <circle
                  cx={ln.x} cy={ln.y} r={ln.r}
                  fill="none"
                  stroke={ln.color}
                  strokeWidth={ln.depth === 0 ? 4 : 3}
                  filter="url(#gtv-glow)"
                />
              )}

              {/* Progress % text inside root-level nodes */}
              {ln.depth === 0 && (
                <text
                  x={ln.x} y={ln.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="9" fontWeight="bold"
                  fill={prog >= 1 ? ln.color : `${ln.color}CC`}
                  fontFamily="inherit"
                >
                  {ln.node.progress}%
                </text>
              )}

              {/* Collapse/expand indicator */}
              {hasKids && (
                <text
                  x={ln.x + ln.r - 2} y={ln.y - ln.r + 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="10"
                  fill="rgba(255,255,255,0.6)"
                  fontFamily="inherit"
                >
                  {isCollapsed ? '+' : '−'}
                </text>
              )}

              {/* Node label */}
              <text
                x={ln.x}
                y={ln.y + ln.r + (ln.depth === 0 ? 17 : 13)}
                textAnchor="middle"
                fontSize={ln.depth === 0 ? '11' : '10'}
                fontWeight={ln.depth === 0 ? '600' : '400'}
                fill={isHov ? ln.color : `rgba(255,255,255,${ln.depth === 0 ? 0.85 : 0.65})`}
                fontFamily="inherit"
              >
                {label}
              </text>

              {/* Sub-node progress shown as small text below label */}
              {ln.depth > 0 && (
                <text
                  x={ln.x}
                  y={ln.y + ln.r + 24}
                  textAnchor="middle"
                  fontSize="9"
                  fill={`${ln.color}99`}
                  fontFamily="inherit"
                >
                  {ln.node.progress}%
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
