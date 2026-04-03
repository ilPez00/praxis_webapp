import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Tabs, Tab, Box, Typography, List, ListItemButton,
  ListItemAvatar, Avatar, ListItemText, CircularProgress, Chip,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/LocationOn';
import SearchIcon from '@mui/icons-material/Search';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';

export interface Reference {
  type: 'person' | 'event' | 'place' | 'goal' | 'service' | 'post' | 'group';
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  city?: string;
  avatar_url?: string;
}

export interface ReferencePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (ref: Reference | null) => void;
  selected?: Reference | null;
  userId?: string;
}

const ReferencePicker: React.FC<ReferencePickerProps> = ({
  open,
  onClose,
  onSelect,
  selected,
}) => {
  const [tab, setTab] = useState<'people' | 'events' | 'places'>('people');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [tab, search, open]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let data: any[] = [];

      if (tab === 'people') {
        const res = await api.get(`/matches?userId=${session.user.id}`).catch(() => null);
        const matches = res?.data;
        data = (matches || []).map((m: any) => ({
          type: 'person',
          id: m.id,
          name: m.name,
          subtitle: m.bio || 'Accountability partner',
          avatar_url: m.avatar_url,
        }));
      } else if (tab === 'events') {
        const { data: events } = await supabase
          .from('events')
          .select('id, title, description, event_date, city')
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true })
          .limit(20);
        data = (events || []).map((e: any) => ({
          type: 'event',
          id: e.id,
          name: e.title,
          subtitle: `${new Date(e.event_date).toLocaleDateString()}${e.city ? ' · ' + e.city : ''}`,
          city: e.city,
        }));
      } else if (tab === 'places') {
        const { data: places } = await supabase
          .from('places')
          .select('id, name, description, city, tags')
          .order('created_at', { ascending: false })
          .limit(20);
        data = (places || []).map((p: any) => ({
          type: 'place',
          id: p.id,
          name: p.name,
          subtitle: p.city || p.description,
          city: p.city,
        }));
      }

      setItems(data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: any) => {
    onSelect(item);
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'person': return <PersonIcon />;
      case 'event': return <EventIcon />;
      case 'place': return <PlaceIcon />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Link Reference
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Attach a person, event, or place to your entry
        </Typography>
      </DialogTitle>
      <DialogContent>
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
          }}
          sx={{ mb: 2 }}
        />

        {/* Tabs */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="People" value="people" />
          <Tab label="Events" value="events" />
          <Tab label="Places" value="places" />
        </Tabs>

        {/* List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No items found
          </Typography>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {items.map((item) => (
              <ListItemButton
                key={item.id}
                onClick={() => handleSelect(item)}
                sx={{
                  bgcolor: selected?.id === item.id ? 'primary.light' : 'transparent',
                  '&:hover': { bgcolor: 'primary.main', color: 'white' },
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: item.avatar_url ? 'transparent' : 'primary.main' }}>
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getIcon(item.type)
                    )}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={item.name}
                  secondary={item.subtitle}
                />
                {selected?.id === item.id && (
                  <Chip label="Selected" size="small" color="primary" />
                )}
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {selected && (
          <Button onClick={() => onSelect(null)} sx={{ mr: 'auto' }}>
            Clear
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ReferencePicker;
