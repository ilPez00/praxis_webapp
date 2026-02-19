import React from 'react';
import { Paper } from '@mui/material';
import type { PaperProps, SxProps, Theme } from '@mui/material';

export interface GlassCardProps extends Omit<PaperProps, 'sx'> {
  /** Preset glow: 'primary' (amber), 'secondary' (violet), 'none' */
  glow?: 'primary' | 'secondary' | 'none';
  /** Custom CSS glow color string (overrides `glow` preset) */
  glowColor?: string;
  sx?: SxProps<Theme>;
  children?: React.ReactNode;
}

/**
 * GlassCard — reusable glassmorphism-style Paper wrapper.
 * Provides a semi-transparent frosted-glass surface with backdrop blur,
 * a subtle inner border, and an optional colored glow shadow.
 *
 * Usage:
 *   <GlassCard glow="primary" sx={{ p: 3 }}>...</GlassCard>
 *   <GlassCard glowColor="rgba(16,185,129,0.2)" sx={{ p: 3 }}>...</GlassCard>
 */
const GlassCard: React.FC<GlassCardProps> = ({
  glow = 'none',
  glowColor,
  sx,
  children,
  ...rest
}) => {
  const resolvedGlow = glowColor
    ? `0 0 40px ${glowColor}, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`
    : glow === 'primary'
    ? '0 0 40px rgba(245,158,11,0.15), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
    : glow === 'secondary'
    ? '0 0 40px rgba(139,92,246,0.15), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
    : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)';

  return (
    <Paper
      {...rest}
      sx={{
        background: 'rgba(17,24,39,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        boxShadow: resolvedGlow,
        transition: 'box-shadow 0.3s ease, transform 0.2s ease',
        '&:hover': {
          boxShadow: glowColor
            ? `0 0 56px ${glowColor}, 0 12px 40px rgba(0,0,0,0.5)`
            : resolvedGlow,
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
};

export default GlassCard;
