import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

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
  tooltip = 'Share',
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'notebook' | 'bookmark'>('notebook');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleShare = (action: 'notebook' | 'bookmark') => {
    setSelectedAction(action);
    setAnchorEl(null);
    setNoteDialogOpen(true);
  };

  const saveToNotebook = async () => {
    if (!userId) {
      toast.error('Please sign in to share');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const formattedContent = `**${title}**\n${content || ''}\n\n*Shared from ${sourceTable}*`;

      const { data, error } = await supabase
        .from('notebook_entries')
        .insert({
          user_id: userId,
          entry_type: sourceTable === 'posts' ? 'post' : 'forwarded',
          title: title || 'Shared Item',
          content: formattedContent,
          source_table: sourceTable,
          source_id: sourceId,
          metadata: {
            comment,
            shared_at: new Date().toISOString(),
          },
          is_private: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Saved to notebook!');
      setNoteDialogOpen(false);
      setComment('');
      setAnchorEl(null);
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBookmark = async () => {
    if (!userId) {
      toast.error('Please sign in to bookmark');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('notebook_entries')
        .insert({
          user_id: userId,
          entry_type: 'bookmark',
          title: `Bookmark: ${title}`,
          content: content || '',
          source_table: sourceTable,
          source_id: sourceId,
          metadata: {
            bookmarked_at: new Date().toISOString(),
          },
          is_private: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Bookmarked!');
      setAnchorEl(null);
    } catch (err: any) {
      toast.error('Failed to bookmark: ' + err.message);
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
          setAnchorEl(e.currentTarget);
        }}
        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
      >
        <ShareIcon fontSize="small" />
      </IconButton>

      <Menu 
        anchorEl={anchorEl} 
        open={!!anchorEl} 
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(30,30,40,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <MenuItem onClick={() => handleShare('notebook')}>
          <NoteAddIcon sx={{ mr: 1, fontSize: 18 }} />
          Save to Notebook
        </MenuItem>
        <MenuItem onClick={handleBookmark}>
          <BookmarkIcon sx={{ mr: 1, fontSize: 18 }} />
          Bookmark
        </MenuItem>
      </Menu>

      <Dialog 
        open={noteDialogOpen} 
        onClose={() => setNoteDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(30,30,40,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <DialogTitle>
          {selectedAction === 'notebook' ? 'Save to Notebook' : 'Bookmark'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: '#fff' }}>
              {title}
            </Typography>
            {content && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {content.slice(0, 200)}{content.length > 200 ? '...' : ''}
              </Typography>
            )}
          </Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Add a comment (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            sx={{ 
              mt: 1,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255,255,255,0.05)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button 
            onClick={saveToNotebook} 
            variant="contained" 
            disabled={saving}
            sx={{
              bgcolor: 'primary.main',
              color: '#0A0B14',
              fontWeight: 700,
              '&:hover': { bgcolor: 'primary.light' },
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ShareButton;
