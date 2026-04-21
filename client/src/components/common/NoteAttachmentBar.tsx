import React, { useRef, useState } from 'react';
import {
  Box, IconButton, Chip, TextField, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { supabase } from '../../lib/supabase';

export interface Attachment {
  type: 'file' | 'link';
  url: string;
  name: string;
  mimeType?: string;
}

interface NoteAttachmentBarProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  userId: string;
  accentColor?: string;
  compact?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/json'];

const NoteAttachmentBar: React.FC<NoteAttachmentBarProps> = ({
  attachments, onChange, userId, accentColor = '#A78BFA', compact = false,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('File too large (max 10 MB)');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `notebook/${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('notebook-files').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('notebook-files').getPublicUrl(path);

      onChange([...attachments, {
        type: 'file',
        url: publicUrl,
        name: file.name,
        mimeType: file.type,
      }]);
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;
    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    onChange([...attachments, {
      type: 'link',
      url,
      name: linkName.trim() || url,
    }]);
    setLinkUrl('');
    setLinkName('');
    setLinkDialogOpen(false);
  };

  const handleRemove = (idx: number) => {
    onChange(attachments.filter((_, i) => i !== idx));
  };

  const isImage = (a: Attachment) => a.mimeType?.startsWith('image/');

  return (
    <Box>
      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: attachments.length > 0 ? 0.75 : 0 }}>
        <Tooltip title="Attach file" placement="top">
          <IconButton
            size="small"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: accentColor } }}
          >
            {uploading ? <CircularProgress size={16} /> : <AttachFileIcon sx={{ fontSize: compact ? 16 : 18 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Take photo" placement="top">
          <IconButton
            size="small"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: accentColor } }}
          >
            <PhotoCameraIcon sx={{ fontSize: compact ? 16 : 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add link" placement="top">
          <IconButton
            size="small"
            onClick={() => setLinkDialogOpen(true)}
            sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: accentColor } }}
          >
            <LinkIcon sx={{ fontSize: compact ? 16 : 18 }} />
          </IconButton>
        </Tooltip>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
        />
        <input
          ref={cameraRef}
          type="file"
          hidden
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
        />
      </Box>

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {attachments.map((a, i) => (
            <Chip
              key={i}
              icon={a.type === 'link' ? <LinkIcon sx={{ fontSize: '14px !important' }} /> : isImage(a) ? <ImageIcon sx={{ fontSize: '14px !important' }} /> : <InsertDriveFileIcon sx={{ fontSize: '14px !important' }} />}
              label={a.name.length > 25 ? a.name.slice(0, 22) + '...' : a.name}
              size="small"
              onDelete={() => handleRemove(i)}
              deleteIcon={<CloseIcon sx={{ fontSize: '12px !important' }} />}
              component="a"
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              sx={{
                fontSize: '0.65rem', height: 24, maxWidth: 200,
                bgcolor: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.3)' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            />
          ))}
        </Box>
      )}

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} PaperProps={{ sx: { borderRadius: '16px', minWidth: 320 } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem' }}>Add Link</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            autoFocus
            label="URL"
            placeholder="https://example.com"
            fullWidth
            size="small"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && linkUrl.trim()) handleAddLink(); }}
          />
          <TextField
            label="Label (optional)"
            placeholder="My resource"
            fullWidth
            size="small"
            value={linkName}
            onChange={e => setLinkName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && linkUrl.trim()) handleAddLink(); }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLinkDialogOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddLink} disabled={!linkUrl.trim()} sx={{ borderRadius: '10px' }}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NoteAttachmentBar;
