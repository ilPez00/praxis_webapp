import React, { useState, useRef } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import HubIcon from '@mui/icons-material/Hub';
import { NetworkNode, NetworkEdge } from './adminTypes';
import { DOMAIN_COLORS } from '../../../types/goal';

// ── Network diagram (circular chord-style) ────────────────────────────────────

const NetworkDiagram: React.FC<{ nodes: NetworkNode[]; edges: NetworkEdge[] }> = ({ nodes, edges }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 560;
  const H = 560;
  const CX = W / 2;
  const CY = H / 2;
  const ORBIT_R = 210;
  const NODE_R = 18;

  if (nodes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
        <HubIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
        <Typography variant="body2">No users with goal trees yet.</Typography>
      </Box>
    );
  }

  // Arrange nodes in a circle
  const positions = nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
    return { ...n, px: CX + ORBIT_R * Math.cos(angle), py: CY + ORBIT_R * Math.sin(angle) };
  });
  const posMap = new Map(positions.map((p) => [p.id, p]));

  // Assign color to each node by first domain
  const nodeColor = (n: NetworkNode) => {
    const d = n.domains[0];
    return d ? (DOMAIN_COLORS as Record<string, string>)[d] || '#6B7280' : '#6B7280';
  };

  return (
    <Box sx={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs>
          <filter id="adm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="rgba(8,9,18,0.6)" rx={16} />

        {/* Orbit ring */}
        <circle cx={CX} cy={CY} r={ORBIT_R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />

        {/* Center hub */}
        <circle cx={CX} cy={CY} r={28} fill="rgba(30,32,55,0.9)" stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
        <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="inherit">
          {nodes.length} users
        </text>

        {/* Edges (connections) */}
        {edges.map((e, i) => {
          const src = posMap.get(e.source);
          const tgt = posMap.get(e.target);
          if (!src || !tgt) return null;
          const color = e.sharedDomains[0]
            ? (DOMAIN_COLORS as Record<string, string>)[e.sharedDomains[0]] || '#6B7280'
            : '#6B7280';
          // Bezier through center for chord-diagram feel
          return (
            <path
              key={i}
              d={`M ${src.px} ${src.py} Q ${CX} ${CY} ${tgt.px} ${tgt.py}`}
              stroke={color}
              strokeWidth={0.8}
              strokeOpacity={0.18}
              fill="none"
            />
          );
        })}

        {/* Nodes */}
        {positions.map((p) => {
          const color = nodeColor(p);
          const initials = (p.name || '?').slice(0, 2).toUpperCase();
          return (
            <g
              key={p.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(ev) => {
                const rect = svgRef.current?.getBoundingClientRect();
                if (rect) {
                  setTooltip({
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top - 10,
                    label: `${p.name || 'Unknown'} · ${p.points.toLocaleString()} pts · 🔥${p.streak}d\n${p.domains.slice(0, 3).join(', ')}`,
                  });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <circle cx={p.px} cy={p.py} r={NODE_R + 3} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.2} />
              <circle cx={p.px} cy={p.py} r={NODE_R} fill={`${color}33`} stroke={color} strokeWidth={1.5} filter="url(#adm-glow)" />
              <text x={p.px} y={p.py + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="700" fill="rgba(255,255,255,0.85)" fontFamily="inherit">
                {initials}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <Box
          sx={{
            position: 'absolute',
            left: tooltip.x + 8,
            top: tooltip.y,
            bgcolor: 'rgba(10,11,20,0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 1.5,
            px: 1.5, py: 1,
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: 200,
          }}
        >
          {tooltip.label.split('\n').map((line, i) => (
            <Typography key={i} variant="caption" sx={{ display: 'block', color: i === 0 ? 'white' : 'text.secondary', whiteSpace: 'pre' }}>
              {line}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ── Network Tab ───────────────────────────────────────────────────────────────

interface NetworkTabProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  loading: boolean;
  fetchNetwork: () => Promise<void>;
}

const NetworkTab: React.FC<NetworkTabProps> = ({ nodes, edges, loading, fetchNetwork }) => {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>User Connection Network</Typography>
          <Typography variant="caption" color="text.secondary">
            Chord diagram — nodes = users, edges = shared goal domains
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchNetwork} disabled={loading} sx={{ color: 'text.secondary' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <NetworkDiagram nodes={nodes} edges={edges} />
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.disabled">
              {nodes.length} users · {edges.length} connections · Hover nodes for details
            </Typography>
          </Box>
        </>
      )}
    </>
  );
};

export default NetworkTab;
