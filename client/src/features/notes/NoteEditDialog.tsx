import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, IconButton, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import api from '../../lib/api';
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
      // Strip prefixes like "j-" or "t-" if present
      const cleanId = item.id.includes('-') && item.id.length > 30 ? item.id.split('-').slice(1).join('-') : item.id;

      // Use the unified notebook API for updates
      await api.patch(`/notebook/entries/${cleanId}`, { content: note });
      
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
    if (!confirm('Delete this permanently?')) return;
    
    setSaving(true);
    try {
      const cleanId = item.id.includes('-') && item.id.length > 30 ? item.id.split('-').slice(1).join('-') : item.id;

      await api.delete(`/notebook/entries/${cleanId}`);
      
      toast.success('Deleted');
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
            Edit {item.badge}
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
          placeholder="Edit your content..."
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
          <Chip label={item.badge} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: item.color }} />
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
