import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container, Box, Typography, TextField, InputAdornment,
  Chip, IconButton, Menu, MenuItem, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress,
  Paper, Divider, Stack, Avatar, Tooltip, Fab, Grid,
  Card, CardContent, CardActions, Switch, FormControlLabel,
  LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShareIcon from '@mui/icons-material/Share';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PinIcon from '@mui/icons-material/PushPin';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import MessageIcon from '@mui/icons-material/Message';
import PostIcon from '@mui/icons-material/Newspaper';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import NoteIcon from '@mui/icons-material/EditNote';
import LinkIcon from '@mui/icons-material/Link';
import PhotoIcon from '@mui/icons-material/PhotoLibrary';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MicIcon from '@mui/icons-material/Mic';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CloseIcon from '@mui/icons-material/Close';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import ReferencePicker, { Reference } from '../../components/common/ReferencePicker';
import ContentRenderer from '../../components/common/ContentRenderer';

const ENTRY_TYPE_ICONS: Record<string, React.ReactNode> = {
  note: <NoteIcon />,
  user: <PersonIcon />,
  message: <MessageIcon />,
  post: <PostIcon />,
  place: <PlaceIcon />,
  event: <EventIcon />,
  goal: <NoteIcon />,
  achievement: <NoteIcon />,
  link: <LinkIcon />,
  photo: <PhotoIcon />,
  voice_note: <MicIcon />,
  quote: <FormatQuoteIcon />,
};

const ENTRY_TYPE_COLORS: Record<string, string> = {
  note: '#8B5CF6',
  user: '#3B82F6',
  message: '#6366F1',
  post: '#EC4899',
  place: '#10B981',
  event: '#F59E0B',
  goal: '#A78BFA',
  achievement: '#F59E0B',
  link: '#6B7280',
  photo: '#EC4899',
  voice_note: '#8B5CF6',
  quote: '#F59E0B',
};

interface DiaryEntry {
  id: string;
  entry_type: string;
  title: string;
  content: string;
  metadata?: any;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  tags?: string[];
  mood?: string;
  source_table?: string;
  source_id?: string;
  occurred_at: string;
  created_at: string;
  is_pinned: boolean;
}

const DiaryPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [mood, setMood] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [location, setLocation] = useState<{lat?: number, lng?: number, name?: string}>({});
  const [gettingLocation, setGettingLocation] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  // New: File upload and reference linking
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reference, setReference] = useState<Reference | null>(null);
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.get('/diary/entries?limit=100');
      setEntries(res.data);

      // Fetch stats
      try {
        const statsRes = await api.get('/diary/stats');
        setStats(statsRes.data);
      } catch {}
    } catch (err) {
      console.error('Failed to fetch diary entries:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleGetLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: 'Current Location',
          });
          setGettingLocation(false);
          toast.success('Location captured!');
        },
        (error) => {
          setGettingLocation(false);
          toast.error('Could not get location: ' + error.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGettingLocation(false);
      toast.error('Geolocation is not supported by this browser');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleQuickAdd = async () => {
    if (!content.trim() && !title.trim() && !selectedFile) {
      toast.error('Please add a title, content, or attach a file');
      return;
    }

    setUploading(true);
    try {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() ?? 'bin';
        const path = `diary/${user?.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(path, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(path);

        mediaUrl = publicUrl;
        mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
      }

      // Build metadata with reference
      const metadata: any = {};
      if (reference) {
        metadata.reference = reference;
      }

      await api.post('/diary/entries', {
        entry_type: selectedType,
        title: title.trim() || `${selectedType} entry`,
        content: content.trim(),
        tags: tagArray.length > 0 ? tagArray : null,
        mood: mood || null,
        latitude: location.lat || null,
        longitude: location.lng || null,
        location_name: location.name || null,
        is_private: isPrivate,
        media_url: mediaUrl,
        media_type: mediaType,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      toast.success('Entry added to diary!');
      setQuickAddOpen(false);
      setTitle('');
      setContent('');
      setTags('');
      setMood('');
      setLocation({});
      setSelectedFile(null);
      setFilePreview(null);
      setReference(null);
      fetchEntries();
    } catch (err: any) {
      toast.error('Failed to add entry: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePinClick = async (entry: DiaryEntry) => {
    try {
      await api.patch(`/diary/entries/${entry.id}/pin`, { is_pinned: !entry.is_pinned });
      setEntries(prev => prev.map(e =>
        e.id === entry.id ? { ...e, is_pinned: !e.is_pinned } : e
      ));
      toast.success(entry.is_pinned ? 'Unpinned' : 'Pinned');
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleDeleteClick = async (entry: DiaryEntry) => {
    if (!confirm('Delete this diary entry?')) return;
    
    try {
      await api.delete(`/diary/entries/${entry.id}`);
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      toast.success('Entry deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
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

  const groupByDate = (items: DiaryEntry[]) => {
    const groups: Record<string, DiaryEntry[]> = {};
    for (const item of items) {
      const d = item.occurred_at.slice(0, 10);
      (groups[d] ??= []).push(item);
    }
    return groups;
  };

  const grouped = groupByDate(entries);
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 8, position: 'relative' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            📔 My Diary
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Save moments, people, places, and thoughts
          </Typography>
        </Box>
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
              WITH LOCATION
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#10B981' }}>
              {stats.with_location || 0}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 150, bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'block' }}>
              ACTIVE STREAK
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B' }}>
              {stats.streak_days || 0} days
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* Quick Share Types */}
      <Paper sx={{ p: 2, mb: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 2 }}>
          QUICK ADD
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {Object.entries(ENTRY_TYPE_ICONS).map(([type, icon]) => (
            <Chip
              key={type}
              icon={icon}
              label={type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
              onClick={() => {
                setSelectedType(type);
                setQuickAddOpen(true);
              }}
              sx={{
                bgcolor: `${ENTRY_TYPE_COLORS[type]}15`,
                color: ENTRY_TYPE_COLORS[type],
                border: `1px solid ${ENTRY_TYPE_COLORS[type]}30`,
                '&:hover': { bgcolor: `${ENTRY_TYPE_COLORS[type]}25` },
              }}
            />
          ))}
        </Stack>
      </Paper>

      {/* Entries Timeline */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : entries.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <NoteIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6">No diary entries yet</Typography>
          <Typography variant="body2">Click any type above to add your first entry</Typography>
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
                <Card
                  key={entry.id}
                  sx={{
                    p: 0,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ENTRY_TYPE_COLORS[entry.entry_type] || 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      transform: 'translateY(-2px)',
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
                  
                  <CardContent sx={{ p: 2 }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
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
                            }}
                          />
                          {entry.location_name && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                              <LocationOnIcon sx={{ fontSize: 14 }} />
                              <Typography variant="caption">{entry.location_name}</Typography>
                            </Box>
                          )}
                          <Typography sx={{
                            fontSize: '0.6rem',
                            color: 'text.disabled',
                            ml: 'auto',
                          }}>
                            {relativeTime(entry.occurred_at)}
                          </Typography>
                        </Box>
                        
                        {entry.content && (
                          <ContentRenderer
                            content={entry.content}
                            sx={{
                              fontSize: '0.8rem',
                              lineHeight: 1.5,
                              color: 'text.secondary',
                              mb: entry.tags?.length ? 1 : 0,
                              whiteSpace: 'pre-wrap',
                            }}
                          />
                        )}
                        
                        {entry.tags && entry.tags.length > 0 && (
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 1 }}>
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
                  </CardContent>
                  
                  <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                    <IconButton size="small" onClick={() => handlePinClick(entry)}>
                      <PinIcon fontSize="small" sx={{ color: entry.is_pinned ? '#F59E0B' : 'text.secondary' }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteClick(entry)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
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
        <MenuItem onClick={() => {
          setSelectedEntry && handleDeleteClick(selectedEntry!);
          setAnchorEl(null);
        }} sx={{ color: '#EF4444' }}>
          <DeleteIcon sx={{ mr: 1, fontSize: 18 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Quick Add Dialog */}
      <Dialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add to Diary
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {selectedType.charAt(0).toUpperCase() + selectedType.slice(1).replace('_', ' ')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="What would you like to save?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          {/* File Upload */}
          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<AttachFileIcon />}
              sx={{ mr: 1 }}
            >
              Attach File
            </Button>
            {selectedFile && (
              <Chip
                label={selectedFile.name}
                onDelete={handleRemoveFile}
                sx={{ ml: 1 }}
              />
            )}
            {filePreview && (
              <Box sx={{ mt: 2, position: 'relative' }}>
                <img
                  src={filePreview}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
                />
                <IconButton
                  size="small"
                  onClick={handleRemoveFile}
                  sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.6)' }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            )}
          </Box>

          {/* Reference Linking */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setRefPickerOpen(true)}
              startIcon={<LinkIcon />}
              sx={{ mr: 1 }}
            >
              {reference ? `Linked: ${reference.name}` : 'Link Person/Event/Place'}
            </Button>
            {reference && (
              <Chip
                label={reference.name}
                onDelete={() => setReference(null)}
                sx={{ ml: 1, bgcolor: 'primary.light', color: 'primary.contrastText' }}
              />
            )}
          </Box>

          <TextField
            fullWidth
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            select
            SelectProps={{ native: true }}
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            sx={{ mb: 2 }}
          >
            <option value="">Mood (optional)</option>
            <option value="😊 Good">😊 Good</option>
            <option value="😐 Okay">😐 Okay</option>
            <option value="😔 Low">😔 Low</option>
            <option value="🔥 Great">🔥 Great</option>
            <option value="💪 Strong">💪 Strong</option>
          </TextField>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleGetLocation}
              disabled={gettingLocation}
              startIcon={gettingLocation ? <CircularProgress size={16} /> : <LocationOnIcon />}
              sx={{ mr: 1 }}
            >
              {gettingLocation ? 'Getting location...' : location.name ? '📍 ' + location.name : 'Add Location'}
            </Button>
          </Box>
          <FormControlLabel
            control={
              <Switch checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            }
            label="Private (only I can see)"
          />
          {uploading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickAddOpen(false)}>Cancel</Button>
          <Button onClick={handleQuickAdd} variant="contained" disabled={uploading || (!content.trim() && !title.trim() && !selectedFile)}>
            {uploading ? 'Uploading...' : 'Add to Diary'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reference Picker Dialog */}
      <ReferencePicker
        open={refPickerOpen}
        onClose={() => setRefPickerOpen(false)}
        onSelect={setReference}
        selected={reference}
      />

      {/* FAB for quick add */}
      <Fab
        color="primary"
        onClick={() => setQuickAddOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: '#A78BFA',
          '&:hover': { bgcolor: '#8B5CF6' },
        }}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};

export default DiaryPage;
