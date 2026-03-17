import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, List, ListItem, ListItemIcon,
  ListItemText, Divider, TextField, IconButton, Chip, Stack,
  Avatar, Card, CardContent, Tooltip,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import BookIcon from '@mui/icons-material/Book';
import LinkIcon from '@mui/icons-material/Link';
import TwitterIcon from '@mui/icons-material/Twitter';
import TelegramIcon from '@mui/icons-material/Telegram';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FacebookIcon from '@mui/icons-material/Facebook';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  sourceTable: 'posts' | 'places' | 'events' | 'goal_nodes' | 'profiles' | 'messages' | 'notebook_entries';
  sourceId: string;
  title?: string;
  content?: string;
  metadata?: any;
}

interface Contact {
  id: string;
  name: string;
  avatar_url?: string;
}

interface Group {
  id: string;
  name: string;
  member_count?: number;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onClose,
  sourceTable,
  sourceId,
  title = 'Shared item',
  content = '',
  metadata = {},
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'diary' | 'social' | 'praxis'>('diary');
  const [diaryNote, setDiaryNote] = useState('');
  const [diaryTags, setDiaryTags] = useState('');
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  // Load contacts and groups when praxis tab is opened
  React.useEffect(() => {
    if (open && activeTab === 'praxis') {
      loadContactsAndGroups();
    }
  }, [open, activeTab]);

  const loadContactsAndGroups = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      // Load contacts (friends/matches)
      const { data: contactsData } = await supabase
        .from('friends')
        .select(`
          id,
          friend_id,
          profiles:profiles2(name, avatar_url)
        `)
        .eq('user_id', userId)
        .limit(20);

      if (contactsData) {
        setContacts(contactsData.map(f => ({
          id: f.friend_id,
          name: f.profiles?.name || 'User',
          avatar_url: f.profiles?.avatar_url,
        })));
      }

      // Load groups
      const { data: groupsData } = await supabase
        .from('chat_rooms')
        .select('id, name')
        .in('type', ['group', 'board'])
        .limit(20);

      if (groupsData) {
        setGroups(groupsData.map(g => ({
          id: g.id,
          name: g.name,
        })));
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    }
  };

  const handleShareToDiary = async () => {
    setSharing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const headers = {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      };

      const tagArray = diaryTags.split(',').map(t => t.trim()).filter(Boolean);

      // Build content with note
      let fullContent = diaryNote ? `${diaryNote}\n\n---\n\n` : '';
      fullContent += `**${title}**\n`;
      if (content) {
        fullContent += `${content}\n\n`;
      }
      fullContent += `*Shared from ${sourceTable.replace('_', ' ')}*`;

      // Get current location if available
      let latitude, longitude, location_name;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          location_name = 'Current Location';
        } catch (err) {
          console.log('Location not available');
        }
      }

      // Use notebook endpoint instead of diary
      const res = await fetch(`${API_URL}/notebook/entries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entry_type: 'note',
          title: title || 'Shared Item',
          content: fullContent,
          source_table: sourceTable,
          source_id: sourceId,
          tags: tagArray.length > 0 ? tagArray : null,
          metadata: location_name ? { latitude, longitude, location_name } : undefined,
        }),
      });

      if (res.ok) {
        toast.success('Saved to notebook!');
        if (onSuccess) {
          onSuccess();
        }
        handleClose();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to save to notebook');
      }
    } catch (err: any) {
      toast.error('Failed to save to notebook: ' + err.message);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/shared/${sourceTable}/${sourceId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareToSocial = (platform: string) => {
    const url = encodeURIComponent(`${window.location.origin}/shared/${sourceTable}/${sourceId}`);
    const text = encodeURIComponent(`${title}\n\n${content?.slice(0, 100) || ''}`);
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
      toast.success(`Opening ${platform}...`);
    }
  };

  const handleShareToPraxis = async () => {
    if (selectedContacts.length === 0 && selectedGroups.length === 0) {
      toast.error('Select at least one contact or group');
      return;
    }

    setSharing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const senderId = session?.user?.id;

      // Send to selected contacts
      for (const contactId of selectedContacts) {
        await supabase.from('messages').insert({
          sender_id: senderId,
          receiver_id: contactId,
          content: `Shared: ${title}\n\n${content?.slice(0, 200) || ''}\n\n${window.location.origin}/shared/${sourceTable}/${sourceId}`,
          metadata: {
            shared_from: sourceTable,
            shared_id: sourceId,
          },
        });
      }

      // Send to selected groups
      for (const groupId of selectedGroups) {
        await supabase.from('chat_messages').insert({
          room_id: groupId,
          sender_id: senderId,
          content: `Shared: ${title}\n\n${content?.slice(0, 200) || ''}\n\n${window.location.origin}/shared/${sourceTable}/${sourceId}`,
          metadata: {
            shared_from: sourceTable,
            shared_id: sourceId,
          },
        });
      }

      toast.success(`Shared with ${selectedContacts.length + selectedGroups.length} recipient(s)!`);
      handleClose();
    } catch (err: any) {
      toast.error('Failed to share: ' + err.message);
    } finally {
      setSharing(false);
    }
  };

  const handleClose = () => {
    onClose();
    setDiaryNote('');
    setDiaryTags('');
    setSelectedContacts([]);
    setSelectedGroups([]);
    setActiveTab('diary');
  };

  const getIconForType = () => {
    switch (sourceTable) {
      case 'posts': return '📝';
      case 'places': return '📍';
      case 'events': return '📅';
      case 'goal_nodes': return '🎯';
      case 'profiles': return '👤';
      case 'messages': return '💬';
      default: return '📌';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShareIcon />
          Share
          <Chip
            label={sourceTable.replace('_', ' ')}
            size="small"
            sx={{ ml: 'auto', bgcolor: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        {/* Preview Card */}
        <Card sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{
                fontSize: '2rem',
                lineHeight: 1,
              }}>
                {getIconForType()}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {title}
                </Typography>
                {content && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {content.slice(0, 100)}{content.length > 100 ? '...' : ''}
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Tab Selection */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            variant={activeTab === 'diary' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setActiveTab('diary')}
            startIcon={<BookIcon />}
            sx={{ flex: 1 }}
          >
            Diary
          </Button>
          <Button
            variant={activeTab === 'social' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setActiveTab('social')}
            startIcon={<LinkIcon />}
            sx={{ flex: 1 }}
          >
            Social
          </Button>
          <Button
            variant={activeTab === 'praxis' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setActiveTab('praxis')}
            startIcon={<PersonIcon />}
            sx={{ flex: 1 }}
          >
            Praxis
          </Button>
        </Stack>

        {/* Diary Tab */}
        {activeTab === 'diary' && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Add a personal note (optional)
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={diaryNote}
              onChange={(e) => setDiaryNote(e.target.value)}
              placeholder="Why are you saving this?"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              value={diaryTags}
              onChange={(e) => setDiaryTags(e.target.value)}
              placeholder="Tags (comma separated)"
              size="small"
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              onClick={handleShareToDiary}
              disabled={sharing}
              startIcon={sharing ? null : <BookIcon />}
              sx={{ mb: 2 }}
            >
              {sharing ? 'Saving...' : 'Save to Diary'}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              onClick={handleCopyLink}
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </Box>
        )}

        {/* Social Tab */}
        {activeTab === 'social' && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Share to social networks
            </Typography>
            <List>
              <ListItem button onClick={() => handleShareToSocial('twitter')} sx={{ borderRadius: 2, mb: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <TwitterIcon sx={{ color: '#1DA1F2' }} />
                </ListItemIcon>
                <ListItemText primary="Share to X (Twitter)" />
              </ListItem>
              <ListItem button onClick={() => handleShareToSocial('telegram')} sx={{ borderRadius: 2, mb: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <TelegramIcon sx={{ color: '#0088cc' }} />
                </ListItemIcon>
                <ListItemText primary="Share to Telegram" />
              </ListItem>
              <ListItem button onClick={() => handleShareToSocial('whatsapp')} sx={{ borderRadius: 2, mb: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <WhatsAppIcon sx={{ color: '#25D366' }} />
                </ListItemIcon>
                <ListItemText primary="Share to WhatsApp" />
              </ListItem>
              <ListItem button onClick={() => handleShareToSocial('facebook')} sx={{ borderRadius: 2, mb: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <FacebookIcon sx={{ color: '#1877F2' }} />
                </ListItemIcon>
                <ListItemText primary="Share to Facebook" />
              </ListItem>
            </List>
            <Divider sx={{ my: 2 }} />
            <Button
              fullWidth
              variant="outlined"
              onClick={handleCopyLink}
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </Box>
        )}

        {/* Praxis Tab */}
        {activeTab === 'praxis' && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Share with contacts
            </Typography>
            <List sx={{ maxHeight: 150, overflowY: 'auto', mb: 2 }}>
              {contacts.map(contact => (
                <ListItem
                  key={contact.id}
                  button
                  selected={selectedContacts.includes(contact.id)}
                  onClick={() => {
                    setSelectedContacts(prev =>
                      prev.includes(contact.id)
                        ? prev.filter(id => id !== contact.id)
                        : [...prev, contact.id]
                    );
                  }}
                  sx={{ borderRadius: 2, mb: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Avatar src={contact.avatar_url} sx={{ width: 32, height: 32 }}>
                      {contact.name?.charAt(0)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText primary={contact.name} />
                  {selectedContacts.includes(contact.id) && (
                    <CheckIcon color="primary" />
                  )}
                </ListItem>
              ))}
            </List>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Share with groups
            </Typography>
            <List sx={{ maxHeight: 150, overflowY: 'auto', mb: 2 }}>
              {groups.map(group => (
                <ListItem
                  key={group.id}
                  button
                  selected={selectedGroups.includes(group.id)}
                  onClick={() => {
                    setSelectedGroups(prev =>
                      prev.includes(group.id)
                        ? prev.filter(id => id !== group.id)
                        : [...prev, group.id]
                    );
                  }}
                  sx={{ borderRadius: 2, mb: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <GroupIcon />
                  </ListItemIcon>
                  <ListItemText primary={group.name} />
                  {selectedGroups.includes(group.id) && (
                    <CheckIcon color="primary" />
                  )}
                </ListItem>
              ))}
            </List>

            <Button
              fullWidth
              variant="contained"
              onClick={handleShareToPraxis}
              disabled={sharing || (selectedContacts.length === 0 && selectedGroups.length === 0)}
              startIcon={<ShareIcon />}
            >
              Share with {selectedContacts.length + selectedGroups.length} recipient(s)
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareDialog;
