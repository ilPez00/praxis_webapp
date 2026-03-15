import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, IconButton, Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface FeedItem {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  detail?: string;
  icon: string;
  color: string;
  badge: string;
  originalId?: string;  // For tracking original item ID
  originalType?: string;  // For tracking original table/type
}

interface NoteEditDialogProps {
  item: FeedItem;
  open: boolean;
  onClose: () => void;
  onUpdated: (updatedItem: FeedItem) => void;
}

const NoteEditDialog: React.FC<NoteEditDialogProps> = ({ item, open, onClose, onUpdated }) => {
  const [note, setNote] = useState(item.detail || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Extract original ID from item.id (format: "j-uuid" or "t-uuid")
      const originalId = item.originalId || item.id.replace(/^[a-z]-/, '');
      
      if (item.type === 'journal' || item.originalType === 'journal') {
        // Try node_journal_entries first
        const { error: nodeError } = await supabase
          .from('node_journal_entries')
          .update({ note })
          .eq('id', originalId);
        
        if (nodeError) {
          // Fallback to journal_entries
          const { error: legacyError } = await supabase
            .from('journal_entries')
            .update({ note })
            .eq('id', originalId);
          
          if (legacyError) throw legacyError;
        }
      } else if (item.type === 'post' || item.originalType === 'post') {
        // Posts can be edited directly
        const { error } = await supabase
          .from('posts')
          .update({ content: note })
          .eq('id', originalId);
        
        if (error) throw error;
      } else if (item.type === 'goal' || item.originalType === 'goal') {
        // Goals: add as a note/comment since goals themselves shouldn't be edited retroactively
        const { error } = await supabase
          .from('goal_notes')
          .insert({
            goal_id: originalId,
            note: `Edit: ${note}`,
            created_at: item.timestamp,
          });
        
        if (error) {
          // If goal_notes doesn't exist, just update the journal entry
          await supabase
            .from('journal_entries')
            .update({ note })
            .eq('id', originalId);
        }
      } else {
        // Default: update journal_entries as fallback
        await supabase
          .from('journal_entries')
          .update({ note })
          .eq('id', originalId);
      }
      
      toast.success('Note updated!');
      onUpdated({ ...item, detail: note });
      onClose();
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this note permanently?')) return;
    
    setSaving(true);
    try {
      const originalId = item.originalId || item.id.replace(/^[a-z]-/, '');
      
      if (item.type === 'journal' || item.originalType === 'journal') {
        const { error: nodeError } = await supabase
          .from('node_journal_entries')
          .delete()
          .eq('id', originalId);
        
        if (nodeError) {
          await supabase
            .from('journal_entries')
            .delete()
            .eq('id', originalId);
        }
      } else if (item.type === 'post' || item.originalType === 'post') {
        // Soft delete posts (add deleted flag)
        await supabase
          .from('posts')
          .update({ is_deleted: true })
          .eq('id', originalId);
      } else {
        await supabase
          .from('journal_entries')
          .delete()
          .eq('id', originalId);
      }
      
      toast.success('Note deleted');
      onUpdated({ ...item, detail: '[DELETED]' });
      onClose();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Edit Note
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          multiline
          rows={6}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Edit your note..."
          sx={{
            mt: 2,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(0,0,0,0.2)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
        />
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={item.type} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: item.color }} />
          <Chip label={new Date(item.timestamp).toLocaleString()} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleDelete} disabled={saving} sx={{ color: '#EF4444', mr: 'auto' }}>
          Delete
        </Button>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || !note.trim()}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NoteEditDialog;
