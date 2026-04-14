import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, CircularProgress, Paper, Stack, Chip, Avatar, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LockIcon from '@mui/icons-material/Lock';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
import ActivityCalendar from './ActivityCalendar';
import { DOMAIN_COLORS, DOMAIN_ICONS, Domain } from '../../types/goal';

interface OutlineNode {
  id: string;
  name: string;
  domain: Domain | string;
  parentId: string | null;
  children: OutlineNode[];
}

interface ProfileLite {
  id: string;
  name: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

function buildOutline(nodes: any[]): OutlineNode[] {
  const map = new Map<string, OutlineNode>();
  for (const n of nodes) {
    map.set(n.id, {
      id: n.id,
      name: n.name,
      domain: n.domain,
      parentId: n.parentId ?? null,
      children: [],
    });
  }
  const roots: OutlineNode[] = [];
  for (const n of nodes) {
    const node = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

const PublicNotebookPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      setLoading(true);
      const [profileRes, goalsRes] = await Promise.all([
        supabase.from('profiles').select('id, name, username, avatar_url').eq('id', userId).maybeSingle(),
        api.get(`/goals/${userId}`).catch(() => ({ data: null })),
      ]);
      if (!active) return;
      setProfile(profileRes.data ?? null);
      const nodes = goalsRes.data?.nodes ?? [];
      setOutline(Array.isArray(nodes) ? buildOutline(nodes) : []);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [userId]);

  const totalTopics = outline.length;
  const totalChapters = useMemo(
    () => outline.reduce((sum, t) => sum + t.children.length, 0),
    [outline],
  );

  if (!userId) return null;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Avatar src={profile?.avatar_url || undefined} sx={{ width: 44, height: 44 }}>
          {(profile?.name || '?').charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <MenuBookIcon fontSize="small" sx={{ color: '#F59E0B' }} />
            {profile?.name || 'User'}'s Notebook
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LockIcon sx={{ fontSize: 12 }} /> Outline only — entries are private
          </Typography>
        </Box>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* Activity Calendar */}
          <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'rgba(255,255,255,0.75)' }}>
              Activity
            </Typography>
            <ActivityCalendar userId={userId} weeks={16} />
          </Paper>

          {/* Goal Outline */}
          <Paper sx={{ p: 2, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>
                Outline
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {totalTopics} {totalTopics === 1 ? 'topic' : 'topics'} · {totalChapters} {totalChapters === 1 ? 'chapter' : 'chapters'}
              </Typography>
            </Stack>

            {outline.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 3, textAlign: 'center' }}>
                No topics yet.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {outline.map((topic) => {
                  const color = DOMAIN_COLORS[topic.domain] || '#A78BFA';
                  const icon = DOMAIN_ICONS[topic.domain] || '📘';
                  return (
                    <Box key={topic.id}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Box sx={{ fontSize: '1.1rem' }}>{icon}</Box>
                        <Typography sx={{ fontWeight: 700, color }}>
                          {topic.name}
                        </Typography>
                        {topic.children.length > 0 && (
                          <Chip
                            size="small"
                            label={`${topic.children.length} ${topic.children.length === 1 ? 'chapter' : 'chapters'}`}
                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${color}22`, color }}
                          />
                        )}
                      </Stack>
                      {topic.children.length > 0 && (
                        <Stack spacing={0.25} sx={{ pl: 3.5, borderLeft: `2px solid ${color}33`, ml: 1 }}>
                          {topic.children.map((ch) => (
                            <Typography
                              key={ch.id}
                              variant="body2"
                              sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem' }}
                            >
                              • {ch.name}
                            </Typography>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Stack>
      )}
    </Container>
  );
};

export default PublicNotebookPage;
