import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Chip } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';

interface ShareButtonProps {
  content: {
    type: 'axiom_message' | 'axiom_routine' | 'axiom_match' | 'axiom_event' | 'axiom_place' | 'axiom_challenge' | 'axiom_resource';
    title: string;
    content?: string;
    metadata?: any;
  };
  userId: string;
}

const ShareButton: React.FC<ShareButtonProps> = ({ content, userId }) => {
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
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const formattedContent = `**${content.title}**\n${content.content || ''}\n\n*Forwarded from Axiom ${content.type.replace('axiom_', '')}*`;

      const { data, error } = await supabase
        .from('notebook_entries')
        .insert({
          user_id: userId,
          entry_type: 'forwarded',
          title: content.title,
          content: formattedContent,
          metadata: {
            ...content.metadata,
            forwarded_from: 'axiom',
            original_type: content.type,
            comment,
          },
          source_reference: {
            type: content.type,
            original_user_id: userId,
            forwarded_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Saved to notebook!');
      setNoteDialogOpen(false);
      setComment('');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
      >
        <ShareIcon fontSize="small" />
      </IconButton>

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handleShare('notebook')}>
          <NoteAddIcon sx={{ mr: 1, fontSize: 18 }} />
          Save to Notebook
        </MenuItem>
        <MenuItem onClick={() => handleShare('bookmark')}>
          <BookmarkIcon sx={{ mr: 1, fontSize: 18 }} />
          Bookmark
        </MenuItem>
      </Menu>

      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedAction === 'notebook' ? 'Save to Notebook' : 'Bookmark'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {content.title}
            </Typography>
            {content.content && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {content.content.slice(0, 150)}{content.content.length > 150 ? '...' : ''}
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
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveToNotebook} variant="contained" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ShareButton;
