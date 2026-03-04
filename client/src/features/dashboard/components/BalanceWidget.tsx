import React from 'react';
import { Box, Typography, Button, Chip, Stack, Collapse } from '@mui/material';
import BalanceIcon from '@mui/icons-material/Balance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SpaIcon from '@mui/icons-material/Spa';
import GlassCard from '../../../components/common/GlassCard';
import { GoalNode } from '../../../models/GoalNode';
import { DOMAIN_COLORS } from '../../../types/goal';
import { Domain } from '../../../models/Domain';

interface Props {
  nodes: GoalNode[];
  streak: number;
  onTakeZenDay?: () => void;
}

/**
 * BalanceWidget — implements the Master Roshi "Balance Intervention" pillar.
 *
 * Spec (whitepaper §3.7 / Architecture of Intent):
 * If a user is active for >= 14 days (streak) but has ANY domain represented in their
 * goal tree where ALL nodes have 0% progress, trigger a Balance Intervention nudge.
 *
 * "Zen Day" allows the user to mark today as a rest/reflection day.
 * It does NOT break the streak — it just reframes the check-in.
 */
const BalanceWidget: React.FC<Props> = ({ nodes, streak, onTakeZenDay }) => {
  // Only show when user has established a streak (14+ days per spec)
  if (streak < 14 || nodes.length === 0) return null;

  // Compute per-domain average progress
  const domainProgress: Record<string, { total: number; count: number }> = {};
  for (const node of nodes) {
    if (!node.domain) continue;
    if (!domainProgress[node.domain]) domainProgress[node.domain] = { total: 0, count: 0 };
    domainProgress[node.domain].total += node.progress ?? 0;
    domainProgress[node.domain].count += 1;
  }

  const neglectedDomains = Object.entries(domainProgress)
    .filter(([, d]) => d.count > 0 && d.total / d.count === 0)
    .map(([domain]) => domain);

  if (neglectedDomains.length === 0) return null;

  // Find the most active domain (highest avg progress) for context
  const activeDomain = Object.entries(domainProgress)
    .filter(([, d]) => d.count > 0 && d.total / d.count > 0)
    .sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count))[0]?.[0];

  return (
    <Collapse in>
      <GlassCard sx={{
        p: 3,
        mb: 3,
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(16,185,129,0.06) 100%)',
        border: '1px solid rgba(139,92,246,0.25)',
      }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }} justifyContent="space-between">
          <Box sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <BalanceIcon sx={{ color: '#8B5CF6', fontSize: 22 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#8B5CF6' }}>
                Balance Intervention
              </Typography>
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
                label="Master Roshi"
                size="small"
                sx={{ bgcolor: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 700, fontSize: '0.65rem' }}
              />
            </Box>

            {/* Message */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 520 }}>
              {activeDomain
                ? `You've been crushing ${activeDomain} for ${streak} days — but your journey requires more than one pillar.`
                : `You've maintained a ${streak}-day streak — impressive. But growth requires balance.`}
              {' '}These areas of your tree have had no progress yet:
            </Typography>

            {/* Neglected domain chips */}
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2, gap: 1 }}>
              {neglectedDomains.map(domain => {
                const color = DOMAIN_COLORS[domain as Domain] ?? '#6B7280';
                return (
                  <Chip
                    key={domain}
                    label={domain}
                    size="small"
                    sx={{
                      bgcolor: `${color}18`,
                      color: color,
                      border: `1px solid ${color}44`,
                      fontWeight: 700,
                      fontSize: '0.7rem',
                    }}
                  />
                );
              })}
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              "The archer who trains only one arm grows lopsided. True mastery comes from cultivating the whole self."
            </Typography>
          </Box>

          {/* Zen Day CTA */}
          <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<SpaIcon />}
              onClick={onTakeZenDay}
              sx={{
                borderRadius: '10px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #10B981 100%)',
                color: '#fff',
                '&:hover': { background: 'linear-gradient(135deg, #9333EA 0%, #059669 100%)' },
              }}
            >
              Take a Zen Day
            </Button>
            <Typography variant="caption" color="text.disabled" sx={{ textAlign: { sm: 'right' }, maxWidth: 160 }}>
              Preserves your streak. Redirects focus to neglected areas.
            </Typography>
          </Box>
        </Stack>
      </GlassCard>
    </Collapse>
  );
};

export default BalanceWidget;
