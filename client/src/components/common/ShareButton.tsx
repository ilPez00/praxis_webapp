import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Chip, Autocomplete, InputAdornment, IconButton, Collapse, Avatar } from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PersonIcon from '@mui/icons-material/Person';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import TagIcon from '@mui/icons-material/LocalOffer';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

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

      const insertPayload: any = {
        user_id: userId,
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
      }

      // Try with metadata first, fall back without if column doesn't exist yet
      let { data, error } = await supabase
        .from('notebook_entries')
        .insert(insertPayload)
        .select()
        .single();

      if (error && error.message?.includes('metadata')) {
        delete insertPayload.metadata;
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
      } else if (selectedGoal) {
        toast.success(`Shared to "${selectedGoal.name}"!`);
      } else {
        toast.success('Shared to notebook!');
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

          {/* Goal Selection */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, display: 'block' }}>
                🎯 LINK TO GOAL (OPTIONAL)
              </Typography>
              {selectedGoal && (
                <Chip
                  label={`${selectedGoal.name} (${Math.round(selectedGoal.progress * 100)}%)`}
                  size="small"
                  onDelete={() => setSelectedGoal(null)}
                  sx={{
                    bgcolor: 'rgba(139,92,246,0.2)',
                    color: '#A78BFA',
                    border: '1px solid rgba(139,92,246,0.3)',
                    fontWeight: 700,
                  }}
                />
              )}
            </Box>
            
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowGoalPicker(!showGoalPicker)}
              startIcon={showGoalPicker ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{
                mb: 1,
                border: '1px solid rgba(139,92,246,0.3)',
                color: '#A78BFA',
                '&:hover': { border: '1px solid rgba(139,92,246,0.6)', bgcolor: 'rgba(139,92,246,0.1)' },
              }}
            >
              {showGoalPicker ? 'Hide Goals' : `Select from ${goals.length} Goals`}
            </Button>

            <Collapse in={showGoalPicker}>
              <Box sx={{ 
                display: 'flex', 
                gap: 1, 
                flexWrap: 'wrap', 
                mt: 1, 
                p: 2, 
                bgcolor: 'rgba(139,92,246,0.05)',
                borderRadius: 2,
                border: '1px solid rgba(139,92,246,0.1)',
              }}>
                {goals.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    No goals yet. Create a goal first to link notes to it.
                  </Typography>
                ) : (
                  goals.map((goal) => (
                    <Chip
                      key={goal.id}
                      label={`${goal.name} (${Math.round(goal.progress * 100)}%)`}
                      onClick={() => {
                        setSelectedGoal(goal);
                        setShowGoalPicker(false);
                      }}
                      sx={{
                        bgcolor: selectedGoal?.id === goal.id ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.1)',
                        color: selectedGoal?.id === goal.id ? '#fff' : '#A78BFA',
                        border: selectedGoal?.id === goal.id ? '2px solid #A78BFA' : '1px solid rgba(139,92,246,0.2)',
                        fontWeight: selectedGoal?.id === goal.id ? 700 : 400,
                        '&:hover': {
                          bgcolor: 'rgba(139,92,246,0.2)',
                        },
                      }}
                    />
                  ))
                )}
              </Box>
            </Collapse>
          </Box>

          {/* Domain & Mood Selection - Side by Side */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              🏷️ CATEGORY & VIBE (OPTIONAL)
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {/* Domain Chips */}
              <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  DOMAIN
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {GOAL_DOMAINS.map((domain) => (
                    <Chip
                      key={domain.value}
                      label={`${domain.icon} ${domain.label}`}
                      onClick={() => setSelectedDomain(selectedDomain === domain.value ? null : domain.value)}
                      size="small"
                      sx={{
                        bgcolor: selectedDomain === domain.value ? domain.color : 'rgba(255,255,255,0.05)',
                        color: selectedDomain === domain.value ? '#fff' : 'text.secondary',
                        fontWeight: selectedDomain === domain.value ? 700 : 400,
                        border: selectedDomain === domain.value ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        '&:hover': {
                          bgcolor: `${domain.color}40`,
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Mood Chips */}
              <Box sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  MOOD
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {MOODS.map((mood) => (
                    <Chip
                      key={mood.emoji}
                      label={`${mood.emoji} ${mood.label}`}
                      onClick={() => setSelectedMood(selectedMood === mood.emoji ? null : mood.emoji)}
                      size="small"
                      sx={{
                        bgcolor: selectedMood === mood.emoji ? mood.color : 'rgba(255,255,255,0.05)',
                        color: selectedMood === mood.emoji ? '#fff' : 'text.secondary',
                        fontWeight: selectedMood === mood.emoji ? 700 : 400,
                        border: selectedMood === mood.emoji ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                        '&:hover': {
                          bgcolor: `${mood.color}30`,
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Tags Input */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              🏷️ TAGS
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                sx={{
                  flex: '1 1 200px',
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                    '&.Mui-focused fieldset': { borderColor: '#A78BFA' },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                sx={{
                  border: '1px solid rgba(139,92,246,0.3)',
                  color: '#A78BFA',
                  '&:hover': { border: '1px solid rgba(139,92,246,0.6)', bgcolor: 'rgba(139,92,246,0.1)' },
                }}
              >
                Add Tag
              </Button>
            </Box>
            {tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => handleRemoveTag(tag)}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(139,92,246,0.2)',
                      color: '#A78BFA',
                      border: '1px solid rgba(139,92,246,0.3)',
                      fontWeight: 600,
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* File Upload */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 700, display: 'block', mb: 1 }}>
              📎 ATTACH MEDIA (OPTIONAL)
            </Typography>
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
              disabled={uploading}
              sx={{
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'text.secondary',
                '&:hover': { border: '1px solid rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </Button>
            {selectedFile && (
              <Chip
                label={selectedFile.name}
                onDelete={handleRemoveFile}
                sx={{ ml: 1, bgcolor: 'rgba(139,92,246,0.2)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.3)' }}
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
                  sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            )}
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
            disabled={uploading}
            sx={{
              bgcolor: 'primary.main',
              color: '#0A0B14',
              fontWeight: 700,
              px: 3,
              '&:hover': { bgcolor: 'primary.light' },
            }}
          >
            {uploading ? 'Uploading...' : 'Share to Notebook'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ShareButton;
