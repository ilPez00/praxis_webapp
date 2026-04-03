import React, { useState } from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, MenuItem, Select, FormControl, InputLabel, IconButton } from '@mui/material';
import ReplyIcon from '@mui/icons-material/Reply';
import CloseIcon from '@mui/icons-material/Close';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

// Goal domains for categorization
const GOAL_DOMAINS = [
  { value: 'career', label: '💼 Career', color: '#8B5CF6' },
  { value: 'fitness', label: '💪 Fitness', color: '#EF4444' },
  { value: 'learning', label: '📚 Learning', color: '#10B981' },
  { value: 'relationships', label: '👥 Relationships', color: '#EC4899' },
  { value: 'finance', label: '💰 Finance', color: '#F59E0B' },
  { value: 'health', label: '🏥 Health', color: '#3B82F6' },
  { value: 'creativity', label: '🎨 Creativity', color: '#F472B6' },
  { value: 'spirituality', label: '🧘 Spirituality', color: '#A78BFA' },
  { value: 'community', label: '🌍 Community', color: '#14B8A6' },
  { value: 'personal', label: '🎯 Personal', color: '#6B7280' },
];

interface AxiomReplyProps {
  type: 'bet' | 'match' | 'place' | 'event' | 'resource';
  title: string;
  description?: string;
  userId?: string;
  metadata?: {
    goalId?: string;
    goalName?: string;
    domain?: string;
    matchId?: string;
    placeId?: string;
    eventId?: string;
    challengeType?: string;
  };
}

const AxiomReply: React.FC<AxiomReplyProps> = ({ 
  type, 
  title, 
  description = '', 
  userId,
  metadata = {},
}) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [selectedDomain, setSelectedDomain] = useState(metadata?.domain || GOAL_DOMAINS[0].value);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);

  const handleReply = async () => {
    if (!userId) {
      toast.error('Please sign in to reply');
      return;
    }

    if (!reply.trim()) {
      toast.error('Please add a reply');
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Build notebook entry content
      let entryContent = `**Reply to Axiom ${type.toUpperCase()}: ${title}**\n\n`;
      if (description) {
        entryContent += `> "${description}"\n\n`;
      }
      entryContent += `**My Response:**\n${reply}\n\n`;
      entryContent += `*Replied on ${new Date().toLocaleString()}*`;

      // Build metadata
      const entryMetadata: any = {
        reply_to: 'axiom',
        reply_type: type,
        reply_title: title,
        reply_description: description,
        replied_at: new Date().toISOString(),
        ...metadata,
      };

      const { data, error } = await supabase
        .from('notebook_entries')
        .insert({
          user_id: userId,
          entry_type: 'reflection',
          title: `Reply: ${title}`,
          content: entryContent,
          metadata: entryMetadata,
          domain: selectedDomain,
          is_private: isPrivate,
          mood: null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Reply saved to notebook!');
      setReplyOpen(false);
      setReply('');
    } catch (err: any) {
      toast.error('Failed to save reply: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'bet': return '🎰';
      case 'match': return '🤝';
      case 'place': return '📍';
      case 'event': return '📅';
      case 'resource': return '💡';
      default: return '💬';
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ReplyIcon fontSize="small" />}
        onClick={() => setReplyOpen(true)}
        sx={{
          mt: 1,
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.7rem',
          borderColor: 'rgba(167,139,250,0.3)',
          color: '#A78BFA',
          background: 'rgba(139,92,246,0.06)',
          '&:hover': { 
            background: 'rgba(139,92,246,0.14)', 
            borderColor: '#A78BFA',
          },
        }}
      >
        💬 Reply
      </Button>

      <Dialog 
        open={replyOpen} 
        onClose={() => setReplyOpen(false)} 
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '1.5rem' }}>{getTypeIcon()}</Typography>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Reply to Axiom {type.charAt(0).toUpperCase() + type.slice(1)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Your response will be saved to notebook
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setReplyOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {/* Original Axiom Recommendation */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(139,92,246,0.08)', borderRadius: 2, border: '1px solid rgba(139,92,246,0.2)' }}>
            <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700, display: 'block', mb: 1 }}>
              {getTypeIcon()} AXIOM'S {type.toUpperCase()}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#fff' }}>
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
                {description}
              </Typography>
            )}
            {metadata?.goalName && (
              <Chip 
                label={`🎯 ${metadata.goalName}`} 
                size="small" 
                sx={{ mt: 1, bgcolor: 'rgba(167,139,250,0.2)', color: '#A78BFA' }} 
              />
            )}
          </Box>

          {/* Domain/Goal Categorization */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              📂 CATEGORIZE BY GOAL/INTEREST
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#9CA3AF' }}>Select Domain</InputLabel>
              <Select
                value={selectedDomain}
                label="Select Domain"
                onChange={(e) => setSelectedDomain(e.target.value)}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  color: '#fff',
                }}
              >
                {GOAL_DOMAINS.map((domain) => (
                  <MenuItem key={domain.value} value={domain.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{domain.label}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Reply Text */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              💬 YOUR REPLY
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="What do you think about this? Will you do it? Why or why not?..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              This will be saved to your notebook with the selected category
            </Typography>
          </Box>

          {/* Privacy Toggle */}
          <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block' }}>
                  {isPrivate ? '🔒 PRIVATE' : '🌍 PUBLIC'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isPrivate ? 'Only you can see this reply' : 'Everyone can see this reply'}
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
            onClick={() => setReplyOpen(false)} 
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleReply} 
            variant="contained" 
            disabled={saving || !reply.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: '#0A0B14',
              fontWeight: 700,
              px: 3,
              '&:hover': { bgcolor: 'primary.light' },
            }}
          >
            {saving ? 'Saving...' : 'Save Reply to Notebook'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AxiomReply;
