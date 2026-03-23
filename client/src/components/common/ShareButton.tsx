import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Chip, Autocomplete, InputAdornment, IconButton, Collapse, Avatar } from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PersonIcon from '@mui/icons-material/Person';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TagIcon from '@mui/icons-material/LocalOffer';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';

// Goal domain categories
const GOAL_DOMAINS = [
  { value: 'Career', label: 'Career', icon: '💼', color: '#F59E0B' },
  { value: 'Fitness', label: 'Fitness', icon: '💪', color: '#EF4444' },
  { value: 'Investing / Financial Growth', label: 'Finance', icon: '📈', color: '#10B981' },
  { value: 'Mental Health', label: 'Mental', icon: '🧠', color: '#8B5CF6' },
  { value: 'Philosophical Development', label: 'Philosophy', icon: '📚', color: '#6366F1' },
  { value: 'Friendship / Social Engagement', label: 'Social', icon: '👥', color: '#EC4899' },
  { value: 'Culture / Hobbies / Creative Pursuits', label: 'Creative', icon: '🎨', color: '#F97316' },
  { value: 'Academics', label: 'Academics', icon: '🎓', color: '#3B82F6' },
];

// Mood/vibe options
const MOODS = [
  { emoji: '😊', label: 'Good', color: '#10B981' },
  { emoji: '😐', label: 'Okay', color: '#F59E0B' },
  { emoji: '😔', label: 'Low', color: '#6B7280' },
  { emoji: '🔥', label: 'Great', color: '#EF4444' },
  { emoji: '💪', label: 'Strong', color: '#8B5CF6' },
  { emoji: '🎯', label: 'Focused', color: '#3B82F6' },
  { emoji: '🧘', label: 'Calm', color: '#06B6D4' },
  { emoji: '✨', label: 'Inspired', color: '#EC4899' },
];

interface TaggedUser {
  id: string;
  name: string;
  avatar_url?: string;
}

interface GoalNode {
  id: string;
  name: string;
  domain: string;
  progress: number;
  weight: number;
}

interface ShareButtonProps {
  sourceTable: 'posts' | 'axiom_message' | 'axiom_routine' | 'axiom_match' | 'axiom_event' | 'axiom_place';
  sourceId: string;
  title: string;
  content?: string;
  userId?: string;
  tooltip?: string;
  onSuccess?: () => void; // Callback after successful share
}

const ShareButton: React.FC<ShareButtonProps> = ({
  sourceTable,
  sourceId,
  title,
  content = '',
  userId,
  tooltip = 'Share to Notebook',
  onSuccess,
}) => {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(true);
  
  // New: Goal selection
  const [selectedGoal, setSelectedGoal] = useState<GoalNode | null>(null);
  const [goals, setGoals] = useState<GoalNode[]>([]);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  
  // New: Mood/vibe selection
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  
  // New: Domain selection
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  
  // New: Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // New: File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch user's matches/friends for tagging AND goals
  const [availableUsers, setAvailableUsers] = useState<TaggedUser[]>([]);

  useEffect(() => {
    if (userId && shareDialogOpen) {
      fetchAvailableUsers();
      fetchUserGoals();
    }
  }, [userId, shareDialogOpen]);

  const fetchAvailableUsers = async () => {
    if (!userId) return;
    try {
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

  const fetchUserGoals = async () => {
    try {
      const { data: goalTree } = await supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .single();

      if (goalTree?.nodes) {
        const goalList = (goalTree.nodes as any[]).map((node: any) => ({
          id: node.id,
          name: node.name,
          domain: node.domain,
          progress: node.progress || 0,
          weight: node.weight || 0.5,
        }));
        setGoals(goalList);
      }
    } catch (err) {
      console.error('Failed to fetch goals:', err);
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

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
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

    setUploading(true);
    try {
      // Build content with reply
      let fullContent = reply ? `${reply}\n\n---\n\n` : '';
      fullContent += `**${title}**\n`;
      if (content) {
        fullContent += `${content}\n\n`;
      }
      fullContent += `*Shared from ${sourceTable.replace('_', ' ')}*`;

      // Build metadata with tags, goal, mood, domain, and file
      const metadata: any = {
        reply,
        shared_at: new Date().toISOString(),
        source: sourceTable,
        source_id: sourceId,
      };

      if (taggedUsers.length > 0) {
        metadata.tagged_users = taggedUsers.map(u => ({ id: u.id, name: u.name }));
      }

      if (selectedGoal) {
        metadata.goal_id = selectedGoal.id;
        metadata.goal_name = selectedGoal.name;
        metadata.goal_domain = selectedGoal.domain;
      }

      if (selectedMood) {
        metadata.mood = selectedMood;
      }

      if (selectedDomain) {
        metadata.domain = selectedDomain;
      }

      if (tags.length > 0) {
        metadata.tags = tags;
      }

      // Upload file if selected
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() ?? 'bin';
        const path = `notebook/${userId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(path, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(path);

        mediaUrl = publicUrl;
        mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
        metadata.media_type = mediaType;
        metadata.media_url = mediaUrl;
      }

      // Build the payload for API
      const insertPayload: any = {
        entry_type: 'note', // Always save as note
        title: title || 'Shared Item',
        content: fullContent,
        source_table: sourceTable,
        source_id: sourceId,
        is_private: isPrivate,
        metadata,
      };

      // Add goal_id for direct linking if selected
      if (selectedGoal) {
        insertPayload.goal_id = selectedGoal.id;
        insertPayload.domain = selectedGoal.domain;
      } else if (selectedDomain) {
        insertPayload.domain = selectedDomain;
      } else {
        // Default domain for free notes (no goal selected)
        insertPayload.domain = 'Personal';
      }

      // Use the API endpoint instead of direct Supabase insert
      console.log('[ShareButton] Saving to notebook:', { userId, entry_type: 'note', title, sourceTable });
      const res = await api.post('/notebook/entries', insertPayload);
      console.log('[ShareButton] Entry saved successfully:', res.data.id);

      // Notify tagged users (optional - could add notification system)
      if (taggedUsers.length > 0) {
        toast.success(`Shared to notebook & tagged ${taggedUsers.length} user(s)!`);
      } else if (selectedGoal) {
        toast.success(`Shared to "${selectedGoal.name}"!`);
      } else {
        toast.success('Shared to notebook!');
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      setShareDialogOpen(false);
      setReply('');
      setTaggedUsers([]);
      setSelectedGoal(null);
      setSelectedMood(null);
      setSelectedDomain(null);
      setTags([]);
      setTagInput('');
      setSelectedFile(null);
      setFilePreview(null);
    } catch (err: any) {
      toast.error('Failed to share: ' + err.message);
    } finally {
      setUploading(false);
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
        sx={{ 
          color: 'text.secondary', 
          '&:hover': { 
            color: 'primary.main',
            bgcolor: 'rgba(139,92,246,0.1)',
          } 
        }}
      >
        <NoteAddIcon fontSize="small" />
      </IconButton>

      <Dialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'linear-gradient(145deg, rgba(30,30,40,0.98) 0%, rgba(20,20,30,0.98) 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(139,92,246,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 800, 
          py: 2.5, 
          px: 3,
          borderBottom: '1px solid rgba(139,92,246,0.15)',
          bgcolor: 'rgba(139,92,246,0.03)',
          borderRadius: '12px 12px 0 0',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ 
              width: 36, 
              height: 36, 
              borderRadius: '10px', 
              bgcolor: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A78BFA',
            }}>
              <NoteAddIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                Share to Notebook
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: -0.5 }}>
                Add your thoughts and context
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, px: 3, pb: 2 }}>
          {/* Original Content Preview - Compact */}
          <Box sx={{ 
            mb: 2.5, 
            p: 2, 
            bgcolor: 'rgba(255,255,255,0.02)', 
            borderRadius: 2, 
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: '#fff', fontSize: '0.9rem' }}>
              {title}
            </Typography>
            {content && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                {content.slice(0, 150)}{content.length > 150 ? '...' : ''}
              </Typography>
            )}
          </Box>

          {/* Your Note - Main Input */}
          <Box sx={{ mb: 2.5 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="✨ What are your thoughts on this?"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(139,92,246,0.03)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: 'rgba(139,92,246,0.4)' },
                  '&.Mui-focused fieldset': { borderColor: '#A78BFA' },
                },
              }}
            />
          </Box>

          {/* Quick Options - Collapsible */}
          <Box sx={{ mb: 2 }}>
            <Button
              variant="text"
              size="small"
              onClick={() => setShowGoalPicker(!showGoalPicker)}
              startIcon={showGoalPicker ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{
                color: '#A78BFA',
                fontWeight: 700,
                fontSize: '0.75rem',
                mb: showGoalPicker ? 1 : 0,
                '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
              }}
            >
              {showGoalPicker ? 'Hide options' : 'Add details (optional)'}
            </Button>

            <Collapse in={showGoalPicker}>
              <Box sx={{ mt: 1 }}>
                {/* Goal Selection */}
                {goals.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                      🎯 LINK TO GOAL
                    </Typography>
                    {selectedGoal ? (
                      <Chip
                        label={`${selectedGoal.name} (${Math.round(selectedGoal.progress * 100)}%)`}
                        onDelete={() => setSelectedGoal(null)}
                        sx={{
                          bgcolor: 'rgba(139,92,246,0.2)',
                          color: '#A78BFA',
                          border: '1px solid rgba(139,92,246,0.3)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                        }}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        {goals.slice(0, 5).map((goal) => (
                          <Chip
                            key={goal.id}
                            label={`${goal.name.slice(0, 25)}${goal.name.length > 25 ? '...' : ''}`}
                            onClick={() => {
                              setSelectedGoal(goal);
                            }}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(139,92,246,0.1)',
                              color: '#A78BFA',
                              border: '1px solid rgba(139,92,246,0.2)',
                              fontSize: '0.75rem',
                              '&:hover': { bgcolor: 'rgba(139,92,246,0.2)' },
                            }}
                          />
                        ))}
                        {goals.length > 5 && (
                          <Chip
                            label={`+${goals.length - 5} more`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                )}

                {/* Domain & Mood - Side by Side */}
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                      🏷️ DOMAIN
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {GOAL_DOMAINS.slice(0, 4).map((domain) => (
                        <Chip
                          key={domain.value}
                          label={`${domain.icon}`}
                          onClick={() => setSelectedDomain(selectedDomain === domain.value ? null : domain.value)}
                          size="small"
                          sx={{
                            bgcolor: selectedDomain === domain.value ? domain.color : 'rgba(255,255,255,0.05)',
                            color: selectedDomain === domain.value ? '#fff' : 'text.secondary',
                            fontSize: '0.85rem',
                            width: 32,
                            height: 32,
                            minWidth: 'auto',
                            padding: 0,
                            border: selectedDomain === domain.value ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                      😊 MOOD
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {MOODS.slice(0, 4).map((mood) => (
                        <Chip
                          key={mood.emoji}
                          label={mood.emoji}
                          onClick={() => setSelectedMood(selectedMood === mood.emoji ? null : mood.emoji)}
                          size="small"
                          sx={{
                            bgcolor: selectedMood === mood.emoji ? mood.color : 'rgba(255,255,255,0.05)',
                            color: selectedMood === mood.emoji ? '#fff' : 'text.secondary',
                            fontSize: '1rem',
                            width: 32,
                            height: 32,
                            minWidth: 'auto',
                            padding: 0,
                            border: selectedMood === mood.emoji ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>

                {/* Tags */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1, fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                    🏷️ TAGS
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Add tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(255,255,255,0.03)',
                          fontSize: '0.85rem',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                          '&.Mui-focused fieldset': { borderColor: '#A78BFA' },
                        },
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      sx={{
                        bgcolor: '#A78BFA',
                        color: '#0A0B14',
                        fontWeight: 700,
                        minWidth: 'auto',
                        px: 2,
                        '&:hover': { bgcolor: '#8B5CF6' },
                        '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'text.disabled' },
                      }}
                    >
                      Add
                    </Button>
                  </Box>
                  {tags.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                      {tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={`#${tag}`}
                          onDelete={() => handleRemoveTag(tag)}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(139,92,246,0.15)',
                            color: '#A78BFA',
                            border: '1px solid rgba(139,92,246,0.3)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            </Collapse>
          </Box>

          {/* File Upload - Simplified */}
          <Box sx={{ mb: 2.5 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button
              fullWidth
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<AttachFileIcon />}
              disabled={uploading}
              sx={{
                border: '1px dashed rgba(139,92,246,0.3)',
                color: 'text.secondary',
                py: 1.5,
                '&:hover': { 
                  border: '1px dashed rgba(139,92,246,0.6)', 
                  bgcolor: 'rgba(139,92,246,0.05)',
                },
              }}
            >
              {uploading ? (
                <CircularProgress size={20} sx={{ mr: 1 }} />
              ) : selectedFile ? (
                <CheckCircleIcon sx={{ mr: 1, color: '#10B981' }} />
              ) : (
                <AttachFileIcon sx={{ mr: 1 }} />
              )}
              {uploading ? 'Uploading...' : selectedFile ? `📎 ${selectedFile.name}` : 'Attach file (optional)'}
            </Button>
            {filePreview && (
              <Box sx={{ mt: 2, position: 'relative' }}>
                <img
                  src={filePreview}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12 }}
                />
                <IconButton
                  size="small"
                  onClick={handleRemoveFile}
                  sx={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8, 
                    bgcolor: 'rgba(0,0,0,0.7)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.9)' },
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            )}
          </Box>

          {/* Privacy Toggle - Simple */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'rgba(255,255,255,0.02)', 
            borderRadius: 2, 
            border: '1px solid rgba(255,255,255,0.06)',
            mb: 2,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isPrivate ? (
                  <Box sx={{ 
                    width: 24, height: 24, 
                    borderRadius: '6px', 
                    bgcolor: 'rgba(139,92,246,0.2)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: '0.8rem' }}>🔒</Typography>
                  </Box>
                ) : (
                  <Box sx={{ 
                    width: 24, height: 24, 
                    borderRadius: '6px', 
                    bgcolor: 'rgba(59,130,246,0.2)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography sx={{ fontSize: '0.8rem' }}>🌍</Typography>
                  </Box>
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {isPrivate ? 'Private note' : 'Public note'}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => setIsPrivate(!isPrivate)}
                sx={{
                  bgcolor: isPrivate ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)',
                  color: isPrivate ? '#A78BFA' : '#3B82F6',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  px: 2,
                  py: 0.5,
                  border: `1px solid ${isPrivate ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  '&:hover': { 
                    bgcolor: isPrivate ? 'rgba(139,92,246,0.3)' : 'rgba(59,130,246,0.3)',
                  },
                }}
              >
                {isPrivate ? 'Private' : 'Public'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, borderTop: '1px solid rgba(139,92,246,0.15)' }}>
          <Button
            onClick={() => setShareDialogOpen(false)}
            sx={{ 
              color: 'text.secondary',
              fontWeight: 600,
              px: 2,
              '&:hover': { color: 'text.primary' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={saveToDiary}
            variant="contained"
            disabled={uploading || (!reply.trim() && !selectedFile)}
            sx={{
              bgcolor: '#A78BFA',
              color: '#0A0B14',
              fontWeight: 800,
              px: 4,
              py: 1.2,
              borderRadius: 2,
              fontSize: '0.9rem',
              '&:hover': { bgcolor: '#8B5CF6' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'text.disabled' },
              boxShadow: '0 4px 14px rgba(139,92,246,0.4)',
            }}
          >
            {uploading ? 'Sharing...' : 'Share Note'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ShareButton;
