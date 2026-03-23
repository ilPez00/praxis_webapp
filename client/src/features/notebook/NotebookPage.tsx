import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, TextField, InputAdornment,
  Chip, IconButton, Menu, MenuItem, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress,
  Tabs, Tab, Paper, Divider, Stack, Avatar, Tooltip,
  FormControl, InputLabel, Select,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import EventIcon from '@mui/icons-material/Event';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PublicIcon from '@mui/icons-material/Public';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HandshakeIcon from '@mui/icons-material/Handshake';
import VerifiedIcon from '@mui/icons-material/Verified';
import PeopleIcon from '@mui/icons-material/People';
import ChatIcon from '@mui/icons-material/Chat';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PinIcon from '@mui/icons-material/PushPin';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ReplyIcon from '@mui/icons-material/Reply';
import ShareIcon from '@mui/icons-material/Share';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import api from '../../lib/api';
import NoteEditDialog from './NoteEditDialog';
import ShareDialog from '../../components/common/ShareDialog';
import ContentRenderer from '../../components/common/ContentRenderer';
import NoteAttachmentBar from '../../components/common/NoteAttachmentBar';
import AxiomQueryDialog from './AxiomQueryDialog';
import type { Attachment } from '../../components/common/NoteAttachmentBar';

const ENTRY_TYPE_ICONS: Record<string, React.ReactNode> = {
  note: <EditNoteIcon />,
  tracker: <FitnessCenterIcon />,
  goal_progress: <BookmarkIcon />,
  post: <PublicIcon />,
  event: <EventIcon />,
  message: <ChatIcon />,
  checkin: <CheckCircleIcon />,
  achievement: <EmojiEventsIcon />,
  bet: <HandshakeIcon />,
  match: <PeopleIcon />,
  verification: <VerifiedIcon />,
  comment: <ChatIcon />,
  axiom_brief: <SmartToyIcon />,
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  note: '#8B5CF6',
  tracker: '#F59E0B',
  goal_progress: '#10B981',
  post: '#3B82F6',
  event: '#EC4899',
  message: '#6366F1',
  checkin: '#10B981',
  achievement: '#F59E0B',
  bet: '#EF4444',
  match: '#EC4899',
  verification: '#06B6D4',
  comment: '#6B7280',
  axiom_brief: '#A78BFA',
};

interface NotebookEntry {
  id: string;
  entry_type: string;
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  goal_id?: string;
  domain?: string;
  source_table?: string;
  source_id?: string;
  occurred_at: string;
  created_at: string;
  is_pinned: boolean;
}

const NotebookPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [editingEntry, setEditingEntry] = useState<NotebookEntry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedEntry, setSelectedEntry] = useState<NotebookEntry | null>(null);
  const [stats, setStats] = useState<any>(null);
  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  // Share state
  const [shareEntry, setShareEntry] = useState<NotebookEntry | null>(null);
  // Axiom Query state
  const [axiomDialogOpen, setAxiomDialogOpen] = useState(false);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [isPremium, setIsPremium] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        user_id: user.id,
        limit: '100',
      });

      if (filterType !== 'all') params.append('entry_type', filterType);
      if (filterDomain !== 'all') params.append('domain', filterDomain);
      if (filterTag !== 'all') params.append('tag', filterTag);
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`/notebook/entries?${params.toString()}`);
      setEntries(res.data);

      // Fetch stats
      try {
        const statsRes = await api.get('/notebook/stats');
        setStats(statsRes.data);
      } catch {
        setStats({ total_entries: 0, streak_days: 0, recent_tags: [] });
      }
    } catch (err) {
      console.error('Failed to fetch notebook entries:', err);
      setStats({ total_entries: 0, streak_days: 0, recent_tags: [] });
    } finally {
      setLoading(false);
    }
  }, [user?.id, filterType, filterDomain, filterTag, searchQuery]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Fetch user profile for Axiom button
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: profile } = await api.get('/auth/profile');
        if (profile) {
          setUserPoints(profile.praxis_points || 0);
          setIsPremium(profile.is_premium || false);
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleEditClick = (entry: NotebookEntry, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEntry(entry);
    setEditingEntry(entry);
    setEditDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteClick = async (entry: NotebookEntry) => {
    if (!confirm('Delete this notebook entry?')) return;
    
    try {
      await api.delete(`/notebook/entries/${entry.id}`);
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      toast.success('Entry deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handlePinClick = async (entry: NotebookEntry) => {
    try {
      await api.patch(`/notebook/entries/${entry.id}/pin`, { is_pinned: !entry.is_pinned });
      setEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, is_pinned: !e.is_pinned } : e
      ));
      toast.success(entry.is_pinned ? 'Unpinned' : 'Pinned');
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleEntryUpdated = (updatedEntry: NotebookEntry) => {
    setEntries(prev => prev.map(e => 
      e.id === updatedEntry.id ? updatedEntry : e
    ));
  };

  const handleReply = async (parentEntry: NotebookEntry) => {
    if (!replyText.trim() || !user?.id) return;
    setReplySaving(true);
    try {
      const res = await api.post('/notebook/entries', {
        user_id: user.id,
        entry_type: 'note',
        title: `Re: ${parentEntry.title || parentEntry.entry_type}`,
        content: replyText.trim(),
        metadata: {
          reply_to: parentEntry.id,
          reply_to_title: parentEntry.title,
          reply_to_type: parentEntry.entry_type,
        },
        attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
      });
      setEntries(prev => [res.data, ...prev]);
      setReplyText('');
      setReplyAttachments([]);
      setReplyingTo(null);
      toast.success('Reply added');
    } catch { toast.error('Failed to reply'); }
    finally { setReplySaving(false); }
  };

  const handleShareClick = (entry: NotebookEntry) => {
    setShareEntry(entry);
    setAnchorEl(null);
  };

  const relativeTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  const groupByDate = (items: NotebookEntry[]) => {
    const groups: Record<string, NotebookEntry[]> = {};
    for (const item of items) {
      const d = item.occurred_at.slice(0, 10);
      (groups[d] ??= []).push(item);
    }
    return groups;
  };

  const grouped = groupByDate(entries);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const domains = Array.from(new Set(entries.map(e => e.domain).filter(Boolean)));
  const tags = Array.from(new Set(entries.flatMap(e => e.tags || []).filter(Boolean)));
  const types = Array.from(new Set(entries.map(e => e.entry_type)));

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            📓 Smart Notebook
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All your moments, automatically organized
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setAxiomDialogOpen(true)}
            sx={{
              borderRadius: '12px',
              fontWeight: 700,
              px: 2,
              border: '2px solid #A78BFA',
              color: '#A78BFA',
              '&:hover': {
                border: '2px solid #8B5CF6',
                bgcolor: 'rgba(167, 139, 250, 0.08)',
              },
            }}
          >
            Ask Axiom
            {!isPremium && (
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', mt: -0.3 }}>
                {userPoints} PP
              </Typography>
            )}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ borderRadius: '12px', fontWeight: 700, px: 3 }}
          >
            New Note
          </Button>
        </Stack>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Stack direction="row" spacing={2} sx={{ mb: 4, flexWrap: 'wrap' }}>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700, display: 'block' }}>
              TOTAL ENTRIES
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#A78BFA' }}>
              {stats.total_entries || 0}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, display: 'block' }}>
              ACTIVE STREAK
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#10B981' }}>
              {stats.streak_days || 0} days
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'block' }}>
              UNIQUE TAGS
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B' }}>
              {(stats.recent_tags || []).length}
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            placeholder="Search your notebook..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)' } }}
          />
          
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                label="Type"
                onChange={(e) => setFilterType(e.target.value)}
                sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}
              >
                <MenuItem value="all">All Types</MenuItem>
                {types.map(type => (
                  <MenuItem key={type} value={type}>
                    {ENTRY_TYPE_ICONS[type]} <span style={{ marginLeft: 8 }}>{type}</span>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Domain</InputLabel>
              <Select
                value={filterDomain}
                label="Domain"
                onChange={(e) => setFilterDomain(e.target.value)}
                sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}
              >
                <MenuItem value="all">All Domains</MenuItem>
                {domains.map(domain => (
                  <MenuItem key={domain} value={domain}>{domain}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Tag</InputLabel>
              <Select
                value={filterTag}
                label="Tag"
                onChange={(e) => setFilterTag(e.target.value)}
                sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}
              >
                <MenuItem value="all">All Tags</MenuItem>
                {tags.map(tag => (
                  <MenuItem key={tag} value={tag}>{tag}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Paper>

      {/* Entries Timeline */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : entries.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <EditNoteIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6">No entries yet</Typography>
          <Typography variant="body2">Your notebook will automatically fill with activities</Typography>
        </Box>
      ) : (
        dates.map(date => (
          <Box key={date} sx={{ mb: 3 }}>
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: 700, color: '#A78BFA',
              letterSpacing: '0.05em', mb: 1.5, px: 0.5,
              textTransform: 'uppercase',
            }}>
              {new Date(date).toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
              })}
            </Typography>

            <Stack spacing={1}>
              {grouped[date].map(entry => (
                <Paper
                  key={entry.id}
                  onClick={() => {
                    if (entry.entry_type === 'axiom_brief') {
                      navigate('/coaching', { state: { axiomBrief: { title: entry.title, content: entry.content, date: entry.occurred_at } } });
                    }
                  }}
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ENTRY_TYPE_COLORS[entry.entry_type] || 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    cursor: entry.entry_type === 'axiom_brief' ? 'pointer' : 'default',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      transform: 'translateY(-2px)',
                      boxShadow: `0 4px 12px ${ENTRY_TYPE_COLORS[entry.entry_type] || 'rgba(0,0,0,0.3)'}40`,
                    },
                  }}
                >
                  {entry.is_pinned && (
                    <PinIcon sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      fontSize: 16,
                      color: '#F59E0B',
                    }} />
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Box sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '10px',
                      bgcolor: `${ENTRY_TYPE_COLORS[entry.entry_type] || '#888'}20`,
                      border: `1px solid ${ENTRY_TYPE_COLORS[entry.entry_type] || '#888'}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: ENTRY_TYPE_COLORS[entry.entry_type] || '#888',
                      flexShrink: 0,
                    }}>
                      {ENTRY_TYPE_ICONS[entry.entry_type]}
                    </Box>
                    
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography sx={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: ENTRY_TYPE_COLORS[entry.entry_type] || 'text.primary',
                        }}>
                          {entry.title || entry.entry_type}
                        </Typography>
                        <Chip
                          label={entry.entry_type}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.55rem',
                            bgcolor: `${ENTRY_TYPE_COLORS[entry.entry_type] || '#888'}20`,
                            color: ENTRY_TYPE_COLORS[entry.entry_type] || '#888',
                            border: `1px solid ${ENTRY_TYPE_COLORS[entry.entry_type] || '#888'}30`,
                          }}
                        />
                        <Typography sx={{
                          fontSize: '0.6rem',
                          color: 'text.disabled',
                          ml: 'auto',
                        }}>
                          {relativeTime(entry.occurred_at)}
                        </Typography>
                      </Box>
                      
                      <ContentRenderer
                        content={entry.content}
                        sx={{
                          fontSize: '0.8rem',
                          lineHeight: 1.5,
                          color: 'text.secondary',
                          mb: entry.tags?.length || entry.entry_type === 'axiom_brief' ? 1 : 0,
                        }}
                      />

                      {entry.entry_type === 'axiom_brief' && (
                        <Chip
                          label="Open in Axiom"
                          size="small"
                          sx={{
                            height: 20, fontSize: '0.6rem', fontWeight: 700,
                            bgcolor: 'rgba(167,139,250,0.15)',
                            color: '#A78BFA',
                            border: '1px solid rgba(167,139,250,0.3)',
                          }}
                        />
                      )}
                      
                      {entry.tags && entry.tags.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                          {entry.tags.map(tag => (
                            <Chip
                              key={tag}
                              label={`#${tag}`}
                              size="small"
                              onClick={() => navigate(`/search?q=%23${tag}`)}
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                bgcolor: 'rgba(139,92,246,0.15)',
                                color: '#A78BFA',
                                border: '1px solid rgba(139,92,246,0.3)',
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: 'rgba(139,92,246,0.25)',
                                  border: '1px solid rgba(139,92,246,0.5)',
                                },
                              }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnchorEl(e.currentTarget);
                        setSelectedEntry(entry);
                      }}
                      sx={{ color: 'text.secondary' }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {/* Inline reply */}
                  {replyingTo === entry.id && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          maxRows={3}
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(entry); } }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.03)', fontSize: '0.82rem' } }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleReply(entry)}
                          disabled={replySaving || !replyText.trim()}
                          sx={{ color: '#A78BFA', alignSelf: 'flex-end' }}
                        >
                          <SendIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <NoteAttachmentBar
                        attachments={replyAttachments}
                        onChange={setReplyAttachments}
                        userId={user?.id || ''}
                        compact
                      />
                    </Box>
                  )}
                </Paper>
              ))}
            </Stack>
          </Box>
        ))
      )}

      {/* Entry Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={(e) => selectedEntry && handleEditClick(selectedEntry, e)}>
          <EditIcon sx={{ mr: 1, fontSize: 18 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { if (selectedEntry) { setReplyingTo(selectedEntry.id); setAnchorEl(null); } }}>
          <ReplyIcon sx={{ mr: 1, fontSize: 18 }} /> Reply
        </MenuItem>
        <MenuItem onClick={() => selectedEntry && handleShareClick(selectedEntry)}>
          <ShareIcon sx={{ mr: 1, fontSize: 18 }} /> Share
        </MenuItem>
        <MenuItem onClick={() => selectedEntry && handlePinClick(selectedEntry)}>
          <PinIcon sx={{ mr: 1, fontSize: 18 }} /> {selectedEntry?.is_pinned ? 'Unpin' : 'Pin'}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => selectedEntry && handleDeleteClick(selectedEntry)} sx={{ color: '#EF4444' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 18 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      {editingEntry && (
        <NoteEditDialog
          item={{
            id: editingEntry.id,
            type: editingEntry.entry_type,
            timestamp: editingEntry.occurred_at,
            title: editingEntry.title || '',
            detail: editingEntry.content,
            icon: '',
            color: ENTRY_TYPE_COLORS[editingEntry.entry_type] || '#888',
            badge: editingEntry.entry_type,
            originalId: editingEntry.source_id || editingEntry.id,
            originalType: editingEntry.source_table || editingEntry.entry_type,
          }}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingEntry(null);
          }}
          onUpdated={handleEntryUpdated}
        />
      )}

      {/* Share Dialog */}
      {shareEntry && (
        <ShareDialog
          open={!!shareEntry}
          onClose={() => setShareEntry(null)}
          sourceTable="notebook_entries"
          sourceId={shareEntry.id}
          title={shareEntry.title || shareEntry.entry_type}
          content={shareEntry.content}
          onSuccess={() => {
            fetchEntries(); // Refresh the list after sharing
          }}
        />
      )}

      {/* Axiom Query Dialog */}
      <AxiomQueryDialog
        open={axiomDialogOpen}
        onClose={() => setAxiomDialogOpen(false)}
      />
    </Container>
  );
};

export default NotebookPage;
