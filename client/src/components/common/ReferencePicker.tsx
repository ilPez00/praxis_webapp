/**
 * ReferencePicker — modal dialog for attaching a Goal / Service / Post reference
 * to a message or board post.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Tabs, Tab,
  TextField, List, ListItem, ListItemButton, ListItemText,
  ListItemAvatar, Avatar, Typography, CircularProgress,
  InputAdornment,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import EventIcon from '@mui/icons-material/Event';
import SearchIcon from '@mui/icons-material/Search';
import { API_URL } from '../../lib/api';
import { Reference } from './ReferenceCard';

interface Props {
  open: boolean;
  userId: string;
  onSelect: (ref: Reference) => void;
  onClose: () => void;
}

const ReferencePicker: React.FC<Props> = ({ open, userId, onSelect, onClose }) => {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');

  const [goals, setGoals]       = useState<Reference[]>([]);
  const [services, setServices] = useState<Reference[]>([]);
  const [posts, setPosts]       = useState<Reference[]>([]);
  const [groups, setGroups]     = useState<Reference[]>([]);
  const [events, setEvents]     = useState<Reference[]>([]);
  const [loading, setLoading]   = useState(false);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [goalsRes, servicesRes, postsRes, groupsRes, eventsRes] = await Promise.allSettled([
        fetch(`${API_URL}/goals/${userId}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_URL}/services`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/posts?context=general&userId=${userId}`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/groups`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/events`).then(r => r.ok ? r.json() : []),
      ]);

      // Goals: flatten tree nodes
      if (goalsRes.status === 'fulfilled' && goalsRes.value?.nodes) {
        const nodes: any[] = Array.isArray(goalsRes.value.nodes) ? goalsRes.value.nodes : [];
        setGoals(nodes.map(n => ({
          type: 'goal' as const,
          id: n.id,
          title: n.name,
          subtitle: `${n.domain ?? ''}${n.progress != null ? ` · ${Math.round(n.progress * 100)}% done` : ''}`.trim().replace(/^·\s*/, ''),
          url: `/goals/${userId}`,
        })));
      }

      // Services
      if (servicesRes.status === 'fulfilled') {
        const all: any[] = Array.isArray(servicesRes.value) ? servicesRes.value : [];
        setServices(all.map(s => ({
          type: 'service' as const,
          id: s.id,
          title: s.title,
          subtitle: `${s.type ?? ''} · ${s.price ? `${s.price_currency ?? '€'}${s.price}` : 'Free'}`.replace(/^·\s*/, ''),
          url: `/services`,
        })));
      }

      // Posts
      if (postsRes.status === 'fulfilled') {
        const all: any[] = Array.isArray(postsRes.value) ? postsRes.value : [];
        setPosts(all.slice(0, 30).map(p => ({
          type: 'post' as const,
          id: p.id,
          title: p.title || p.content?.slice(0, 60) || 'Untitled post',
          subtitle: `by ${p.user_name}`,
          url: `/communication`,
        })));
      }

      // Groups / boards
      if (groupsRes.status === 'fulfilled') {
        const all: any[] = Array.isArray(groupsRes.value) ? groupsRes.value : [];
        setGroups(all.map(g => ({
          type: 'group' as const,
          id: g.id,
          title: g.name,
          subtitle: g.domain ? `${g.domain}${g.description ? ` · ${g.description.slice(0, 40)}` : ''}` : (g.description?.slice(0, 50) ?? ''),
          url: `/boards/${g.id}`,
        })));
      }

      // Events
      if (eventsRes.status === 'fulfilled') {
        const all: any[] = Array.isArray(eventsRes.value) ? eventsRes.value : [];
        setEvents(all.slice(0, 30).map(e => ({
          type: 'event' as const,
          id: e.id,
          title: e.title,
          subtitle: `${e.event_date ?? ''}${e.location ? ` · ${e.location}` : ''}`.replace(/^·\s*/, ''),
          url: `/events`,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  const filtered = (items: Reference[]) =>
    search.trim()
      ? items.filter(i => `${i.title} ${i.subtitle}`.toLowerCase().includes(search.toLowerCase()))
      : items;

  const lists = [filtered(goals), filtered(services), filtered(posts), filtered(groups), filtered(events)];
  const tabIcons = [
    <FlagIcon sx={{ fontSize: 16 }} />,
    <WorkOutlineIcon sx={{ fontSize: 16 }} />,
    <ArticleOutlinedIcon sx={{ fontSize: 16 }} />,
    <GroupsIcon sx={{ fontSize: 16 }} />,
    <EventIcon sx={{ fontSize: 16 }} />,
  ];
  const tabLabels = ['Goals', 'Services', 'Posts', 'Groups', 'Events'];
  const tabColors = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, pb: 0 }}>Attach a Reference</DialogTitle>
      <DialogContent sx={{ pt: 1, px: 2, pb: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment> }}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', py: 0, gap: 0.5 },
            '& .MuiTabs-indicator': { bgcolor: tabColors[tab] },
          }}
        >
          {tabLabels.map((label, i) => (
            <Tab key={label} label={label} icon={tabIcons[i]} iconPosition="start"
              sx={{ color: tab === i ? `${tabColors[i]} !important` : 'text.secondary' }} />
          ))}
        </Tabs>
      </DialogContent>

      <Box sx={{ px: 2, pb: 2, maxHeight: 340, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : lists[tab].length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 3 }}>
            {search ? 'No matches.' : `No ${tabLabels[tab].toLowerCase()} found.`}
          </Typography>
        ) : (
          <List dense disablePadding>
            {lists[tab].map(ref => (
              <ListItem key={ref.id} disablePadding>
                <ListItemButton
                  onClick={() => { onSelect(ref); onClose(); }}
                  sx={{ borderRadius: '10px', px: 1.5, py: 0.75, '&:hover': { bgcolor: `${tabColors[tab]}11` } }}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: `${tabColors[tab]}22`, color: tabColors[tab] }}>
                      {tabIcons[tab]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={ref.title}
                    secondary={ref.subtitle}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.88rem', noWrap: true }}
                    secondaryTypographyProps={{ fontSize: '0.72rem', noWrap: true }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Dialog>
  );
};

export default ReferencePicker;
