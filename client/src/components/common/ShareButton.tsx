import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Chip, Autocomplete, InputAdornment, IconButton } from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PersonIcon from '@mui/icons-material/Person';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

// Tracker categories for diary entries
const DIARY_CATEGORIES = [
  { value: 'note', label: '📝 Note', icon: '📝' },
  { value: 'tracker', label: '📊 Tracker', icon: '📊' },
  { value: 'goal', label: '🎯 Goal', icon: '🎯' },
  { value: 'reflection', label: '💭 Reflection', icon: '💭' },
  { value: 'achievement', label: '🏆 Achievement', icon: '🏆' },
  { value: 'idea', label: '💡 Idea', icon: '💡' },
  { value: 'quote', label: '📌 Quote', icon: '📌' },
  { value: 'post', label: '📢 Post', icon: '📢' },
];

interface TaggedUser {
  id: string;
  name: string;
  avatar_url?: string;
}

interface ShareButtonProps {
  sourceTable: 'posts' | 'axiom_message' | 'axiom_routine' | 'axiom_match' | 'axiom_event' | 'axiom_place';
  sourceId: string;
  title: string;
  content?: string;
  userId?: string;
  tooltip?: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({
  sourceTable,
  sourceId,
  title,
  content = '',
  userId,
  tooltip = 'Share to Notebook',
}) => {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [category, setCategory] = useState(DIARY_CATEGORIES[0]);
  const [reply, setReply] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);

  // Fetch user's matches/friends for tagging
  const [availableUsers, setAvailableUsers] = useState<TaggedUser[]>([]);

  useEffect(() => {
    if (userId && shareDialogOpen) {
      fetchAvailableUsers();
    }
  }, [userId, shareDialogOpen]);

  const fetchAvailableUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // Fetch matches
      const { data: matches } = await supabase
        .rpc('match_users_by_goals', { query_user_id: userId, match_limit: 50 });

      if (matches) {
        setAvailableUsers(matches.map((m: any) => ({
          id: m.id,
          name: m.name,
          avatar_url: m.avatar_url,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const saveToDiary = async () => {
    if (!userId) {
      toast.error('Please sign in to share');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Build content with reply
      let fullContent = reply ? `${reply}\n\n---\n\n` : '';
      fullContent += `**${title}**\n`;
      if (content) {
        fullContent += `${content}\n\n`;
      }
      fullContent += `*Shared from ${sourceTable.replace('_', ' ')}*`;

      // Build metadata with tags
      const metadata: any = {
        reply,
        shared_at: new Date().toISOString(),
        source: sourceTable,
        source_id: sourceId,
      };
      
      if (taggedUsers.length > 0) {
        metadata.tagged_users = taggedUsers.map(u => ({ id: u.id, name: u.name }));
      }

      const insertPayload: any = {
        user_id: userId,
        entry_type: category.value,
        title: title || 'Shared Item',
        content: fullContent,
        source_table: sourceTable,
        source_id: sourceId,
        is_private: isPrivate,
      };

      // Try with metadata first, fall back without if column doesn't exist yet
      let { data, error } = await supabase
        .from('notebook_entries')
        .insert({ ...insertPayload, metadata })
        .select()
        .single();

      if (error && error.message?.includes('metadata')) {
        ({ data, error } = await supabase
          .from('notebook_entries')
          .insert(insertPayload)
          .select()
          .single());
      }

      if (error) throw error;

      // Notify tagged users (optional - could add notification system)
      if (taggedUsers.length > 0) {
        toast.success(`Shared to notebook & tagged ${taggedUsers.length} user(s)!`);
      } else {
        toast.success('Shared to notebook!');
      }

      setShareDialogOpen(false);
      setReply('');
      setTaggedUsers([]);
    } catch (err: any) {
      toast.error('Failed to share: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          handleShare();
        }}
        title={tooltip}
        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
      >
        <NoteAddIcon fontSize="small" />
      </IconButton>

      <Dialog
        open={shareDialogOpen} 
        onClose={() => setShareDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(30,30,40,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NoteAddIcon sx={{ color: '#A78BFA' }} />
            Share to Notebook
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {/* Original Content Preview */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              SHARING FROM {sourceTable.replace('_', ' ').toUpperCase()}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#fff' }}>
              {title}
            </Typography>
            {content && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {content.slice(0, 300)}{content.length > 300 ? '...' : ''}
              </Typography>
            )}
          </Box>

          {/* Category Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              📂 CATEGORY
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {DIARY_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.value}
                  label={`${cat.icon} ${cat.label.split(' ')[1]}`}
                  onClick={() => setCategory(cat)}
                  sx={{
                    bgcolor: category.value === cat.value ? 'primary.main' : 'rgba(255,255,255,0.05)',
                    color: category.value === cat.value ? '#0A0B14' : 'text.secondary',
                    fontWeight: category.value === cat.value ? 700 : 400,
                    border: category.value === cat.value ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Reply/Comment - This is the main action for sharing to notebook */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, display: 'block', mb: 1 }}>
              📝 ADD YOUR NOTE
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="What are your thoughts on this? Add a note, reply, or reflection..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(167,139,250,0.05)',
                  border: '1px solid rgba(167,139,250,0.2)',
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: 'rgba(167,139,250,0.4)' },
                  '&.Mui-focused fieldset': { borderColor: '#A78BFA' },
                },
              }}
            />
          </Box>

          {/* Tag Users */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              👥 TAG PEOPLE (OPTIONAL)
            </Typography>
            <Autocomplete
              multiple
              options={availableUsers}
              getOptionLabel={(option) => option.name}
              value={taggedUsers}
              onChange={(_, newValue) => setTaggedUsers(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search and tag accountability partners..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                      '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                    },
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option.id}
                    label={option.name}
                    avatar={
                      option.avatar_url ? (
                        <img src={option.avatar_url} alt={option.name} style={{ width: 24, height: 24, borderRadius: '50%' }} />
                      ) : undefined
                    }
                    {...getTagProps({ index })}
                    sx={{
                      bgcolor: 'rgba(139,92,246,0.2)',
                      color: '#A78BFA',
                      border: '1px solid rgba(139,92,246,0.3)',
                    }}
                  />
                ))
              }
            />
          </Box>

          {/* Privacy Toggle */}
          <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block' }}>
                  {isPrivate ? '🔒 PRIVATE' : '🌍 PUBLIC'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isPrivate ? 'Only you can see this' : 'Everyone can see this'}
                </Typography>
              </Box>
              <Button
                variant={isPrivate ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setIsPrivate(!isPrivate)}
                sx={{
                  bgcolor: isPrivate ? 'primary.main' : 'transparent',
                  color: isPrivate ? '#0A0B14' : 'primary.main',
                  fontWeight: 700,
                }}
              >
                {isPrivate ? 'Private' : 'Public'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button
            onClick={() => setShareDialogOpen(false)}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={saveToDiary}
            variant="contained"
            disabled={saving}
            sx={{
              bgcolor: 'primary.main',
              color: '#0A0B14',
              fontWeight: 700,
              px: 3,
              '&:hover': { bgcolor: 'primary.light' },
            }}
          >
            {saving ? 'Sharing...' : 'Share to Notebook'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ShareButton;
