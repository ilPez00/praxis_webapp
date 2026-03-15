import React, { useEffect, useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { supabase } from '../../lib/supabase';

interface AxiomNoteCardProps {
  userId: string;
}

interface AxiomBrief {
  message: string;
  recap?: string;
  routine?: { time: string; task: string; alignment: string }[];
  challenge?: { target: string; terms: string };
  match?: { name: string; reason: string } | null;
  event?: { title: string; reason: string } | null;
  place?: { name: string; reason: string } | null;
  resources?: { goal: string; suggestion: string; details: string }[];
  source?: 'llm' | 'algorithm';
}

const AxiomNoteCard: React.FC<AxiomNoteCardProps> = ({ userId }) => {
  const [brief, setBrief] = useState<AxiomBrief | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);

    supabase
      .from('axiom_daily_briefs')
      .select('brief')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.brief) {
          const b = typeof data.brief === 'string' ? JSON.parse(data.brief) : data.brief;
          setBrief(b);
        }
      });
  }, [userId]);

  if (!brief?.message) return null;

  return (
    <Box
      onClick={() => setExpanded(!expanded)}
      sx={{
        mb: 2, mx: { xs: 1, sm: 0 },
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(245,158,11,0.05))',
        border: '1px solid rgba(167,139,250,0.2)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': { borderColor: 'rgba(167,139,250,0.35)' },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, pb: expanded ? 1 : 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <Typography sx={{ fontSize: '1.1rem' }}>🧠</Typography>
          <Typography sx={{
            fontSize: '0.65rem', fontWeight: 800, color: '#A78BFA',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Axiom Daily Brief
          </Typography>
          <Typography sx={{
            fontSize: '0.5rem', fontWeight: 700, ml: 'auto', mr: 0.5,
            color: brief.source === 'llm' ? '#A78BFA' : '#F59E0B',
            bgcolor: brief.source === 'llm' ? 'rgba(167,139,250,0.12)' : 'rgba(245,158,11,0.12)',
            px: 0.75, py: 0.15, borderRadius: '4px',
          }}>
            {brief.source === 'llm' ? '🧠 AI' : '⚙️ Auto'}
          </Typography>
          <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>
            {expanded ? 'tap to collapse' : 'tap to expand'}
          </Typography>
        </Box>
        <Typography sx={{
          fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.6,
          color: '#E5E7EB',
          ...(!expanded && {
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }),
        }}>
          {brief.message}
        </Typography>
      </Box>

      {/* Expanded content */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Daily Recap */}
          {brief.recap && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{
                fontSize: '0.6rem', fontWeight: 800, color: '#F59E0B',
                letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.5,
              }}>
                Yesterday's Recap
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                {brief.recap}
              </Typography>
            </Box>
          )}

          {/* Routine */}
          {brief.routine && brief.routine.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{
                fontSize: '0.6rem', fontWeight: 800, color: '#10B981',
                letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.5,
              }}>
                Today's Routine
              </Typography>
              {brief.routine.map((r, i) => (
                <Box key={i} sx={{
                  display: 'flex', gap: 1, py: 0.5,
                  alignItems: 'baseline',
                }}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#10B981', minWidth: 65 }}>
                    {r.time}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#D1D5DB', flex: 1 }}>
                    {r.task}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Match / Event / Place recommendations */}
          {(brief.match || brief.event || brief.place) && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              {brief.match && (
                <Box sx={{
                  flex: 1, minWidth: 100, p: 1, borderRadius: '10px',
                  bgcolor: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.15)',
                }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: '#EC4899', letterSpacing: '0.04em', mb: 0.25 }}>
                    SPARRING MATCH
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#F3F4F6' }}>
                    {brief.match.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)' }}>
                    {brief.match.reason}
                  </Typography>
                </Box>
              )}
              {brief.event && (
                <Box sx={{
                  flex: 1, minWidth: 100, p: 1, borderRadius: '10px',
                  bgcolor: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
                }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: '#06B6D4', letterSpacing: '0.04em', mb: 0.25 }}>
                    EVENT
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#F3F4F6' }}>
                    {brief.event.title}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)' }}>
                    {brief.event.reason}
                  </Typography>
                </Box>
              )}
              {brief.place && (
                <Box sx={{
                  flex: 1, minWidth: 100, p: 1, borderRadius: '10px',
                  bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                }}>
                  <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: '#10B981', letterSpacing: '0.04em', mb: 0.25 }}>
                    PLACE
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#F3F4F6' }}>
                    {brief.place.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)' }}>
                    {brief.place.reason}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Resources / Goal Suggestions */}
          {Array.isArray(brief.resources) && brief.resources.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{
                fontSize: '0.6rem', fontWeight: 800, color: '#3B82F6',
                letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.5,
              }}>
                Goal Insights
              </Typography>
              {brief.resources.map((r, i) => (
                <Box key={i} sx={{ py: 0.4 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#D1D5DB' }}>
                    {r.goal}: <Box component="span" sx={{ fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>{r.suggestion}</Box>
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Challenge */}
          {brief.challenge && (
            <Box sx={{
              p: 1.5, borderRadius: '12px',
              bgcolor: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.15)',
            }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#F59E0B', letterSpacing: '0.06em', mb: 0.25 }}>
                TODAY'S CHALLENGE
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#F3F4F6' }}>
                {brief.challenge.target}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', mt: 0.25 }}>
                {brief.challenge.terms}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default AxiomNoteCard;
