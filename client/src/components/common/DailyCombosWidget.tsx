/**
 * DailyCombosWidget Component
 * Shows today's combo chains and progress toward completing them
 */

import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Tooltip,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

interface Combo {
  id: string;
  label: string;
  description: string;
  xp_bonus: number;
  pp_bonus: number;
  actions: string[];
  progress: number;
  total: number;
  completed: boolean;
  claimed: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  check_in: 'Check In',
  log_tracker: 'Log Tracker',
  journal_entry: 'Journal',
  create_post: 'Post',
  comment_post: 'Comment',
  give_honor: 'Honor',
  complete_goal: 'Goal Done',
};

const DailyCombosWidget: React.FC = () => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/gamification/combos');
        setCombos(data.combos || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || combos.length === 0) return null;

  // Only show combos that have some progress or are completable
  const activeCombos = combos.filter(c => c.progress > 0 || !c.claimed);

  if (activeCombos.length === 0) return null;

  return (
    <Card sx={{
      bgcolor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 3,
      overflow: 'hidden',
    }}>
      <Box sx={{
        px: 2, py: 1.5,
        bgcolor: 'rgba(249,115,22,0.08)',
        borderBottom: '1px solid rgba(249,115,22,0.15)',
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <BoltIcon sx={{ color: '#F97316', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F97316' }}>
          Daily Combos
        </Typography>
      </Box>

      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1.5}>
          {activeCombos.map(combo => (
            <Box key={combo.id} sx={{
              p: 1.5, borderRadius: 2,
              opacity: combo.claimed ? 0.55 : 1,
              bgcolor: combo.claimed
                ? 'rgba(148,163,184,0.06)'
                : combo.completed
                  ? 'rgba(249,115,22,0.08)'
                  : 'rgba(255,255,255,0.03)',
              border: combo.claimed
                ? '1px solid rgba(148,163,184,0.2)'
                : '1px solid rgba(255,255,255,0.06)',
              transition: 'opacity 0.3s, background-color 0.3s',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography variant="body2" sx={{
                  fontWeight: 700,
                  color: combo.claimed ? 'text.secondary' : combo.completed ? '#F97316' : 'text.primary',
                }}>
                  {combo.label}
                  {combo.claimed && ' ✓'}
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  <Chip
                    label={`+${combo.xp_bonus} XP`}
                    size="small"
                    sx={{ bgcolor: 'rgba(167,139,250,0.15)', color: '#A78BFA', fontSize: '0.6rem', fontWeight: 700, height: 20 }}
                  />
                  <Chip
                    label={`+${combo.pp_bonus} PP`}
                    size="small"
                    sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '0.6rem', fontWeight: 700, height: 20 }}
                  />
                </Stack>
              </Box>

              {/* Action checklist */}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {combo.actions.map((action, i) => {
                  const done = i < combo.progress;
                  return (
                    <Tooltip key={action} title={ACTION_LABELS[action] || action}>
                      <Chip
                        size="small"
                        icon={done
                          ? <CheckCircleIcon sx={{ fontSize: '14px !important', color: '#22C55E !important' }} />
                          : <RadioButtonUncheckedIcon sx={{ fontSize: '14px !important' }} />
                        }
                        label={ACTION_LABELS[action] || action}
                        sx={{
                          height: 24,
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          bgcolor: done ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                          color: done ? '#22C55E' : 'text.secondary',
                          border: done ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DailyCombosWidget;
