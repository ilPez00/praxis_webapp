import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Avatar,
  TextField,
  IconButton,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  Collapse,
  Divider,
  Button,
  Tooltip,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import ReferenceCard, { Reference } from '../../components/common/ReferenceCard';
import ReferencePicker from '../../components/common/ReferencePicker';

interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  title: string | null;
  content: string;
  media_url: string | null;
  media_type: string | null;
  context: string;
  reference: Reference | null;
  created_at: string;
  comment_count: number;
}

interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  content: string;
  created_at: string;
}

interface Props {
  context: string; // 'general' | 'coaching' | 'marketplace' | roomId UUID
  isBoard?: boolean; // Reddit-style board mode: shows title field + prominent titles
  personalized?: boolean; // Use the smart personalized feed endpoint
  feedUserId?: string; // Required when personalized=true
  profileUserId?: string; // Profile view: show all posts by this user, no compose box
}

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const renderContentWithMentions = (content: string): React.ReactNode => {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (/^@\w+$/.test(part)) {
      return (
        <Typography
          key={i}
          component="span"
          sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer' }}
        >
          {part}
        </Typography>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

const PostFeed: React.FC<Props> = ({ context, isBoard = false, personalized = false, feedUserId, profileUserId }) => {
  const { user } = useUser();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postVotes, setPostVotes] = useState<Record<string, { score: number; userVote: number }>>({});

  // Compose state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postRef, setPostRef] = useState<Reference | null>(null);
  const [refPickerOpen, setRefPickerOpen] = useState(false);

  // Per-post comment state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      let url: string;
      if (profileUserId) {
        url = `${API_URL}/posts/by-user/${profileUserId}`;
      } else if (personalized && feedUserId) {
        url = `${API_URL}/posts/feed?userId=${feedUserId}`;
      } else {
        const userId = user?.id ? `&userId=${user.id}` : '';
        url = `${API_URL}/posts?context=${context}${userId}`;
      }
      const res = await fetch(url);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  }, [context, user?.id, personalized, feedUserId, profileUserId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Listen for global open compose event
  useEffect(() => {
    const handleOpen = () => {
      const composeBox = document.getElementById('dashboard-post-compose');
      if (composeBox) {
        composeBox.scrollIntoView({ behavior: 'smooth' });
        // Optional: focus the text field if you want
      }
    };
    window.addEventListener('praxis_open_compose', handleOpen);
    return () => window.removeEventListener('praxis_open_compose', handleOpen);
  }, []);

  // ---- Votes ----

  const postIds = posts.map(p => p.id).join(',');

  useEffect(() => {
    if (!posts.length) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const results = await Promise.all(
        posts.slice(0, 20).map(p =>
          axios.get(`${API_URL}/posts/${p.id}/vote`, { headers })
            .then(r => [p.id, r.data] as [string, { score: number; userVote: number }])
            .catch(() => [p.id, { score: 0, userVote: 0 }] as [string, { score: number; userVote: number }])
        )
      );
      const map: Record<string, { score: number; userVote: number }> = {};
      results.forEach(([id, data]) => { map[id] = data; });
      setPostVotes(map);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIds]);

  const handleVote = async (postId: string, value: 1 | -1) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Sign in to vote'); return; }

    const previous = postVotes[postId] ?? { score: 0, userVote: 0 };
    const currentVote = previous.userVote;
    const currentScore = previous.score;

    const optimistic =
      currentVote === value
        ? { userVote: 0, score: currentScore + (value === 1 ? -1 : 1) }
        : { userVote: value, score: currentScore + value - currentVote };

    setPostVotes(prev => ({ ...prev, [postId]: optimistic }));

    try {
      const res = await axios.post(
        `${API_URL}/posts/${postId}/vote`,
        { value },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      setPostVotes(prev => ({ ...prev, [postId]: res.data }));
    } catch {
      setPostVotes(prev => ({ ...prev, [postId]: previous }));
      toast.error('Vote failed');
    }
  };

  // ---- Compose ----

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && f.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFilePreview(null);
    }
    e.target.value = '';
  };

  const clearFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async () => {
    if (!user || !text.trim()) return;
    if (isBoard && !title.trim()) return;
    setSubmitting(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (file) {
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `posts/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(path);
        mediaUrl = publicUrl;
        mediaType = file.type.startsWith('image/') ? 'image' : 'file';
      }

      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name || user.email || 'User',
          userAvatarUrl: user.avatarUrl ?? null,
          title: isBoard ? title.trim() : null,
          content: text.trim(),
          mediaUrl,
          mediaType,
          context,
          reference: postRef ?? undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create post');
      }
      const newPost: Post = await res.json();
      setPosts(prev => [newPost, ...prev]);
      setTitle('');
      setText('');
      clearFile();
      setPostRef(null);
    } catch (err: any) {
      console.error('Post submit error:', err);
      toast.error(err.message || 'Failed to post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Delete post ----

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    const post = posts.find(p => p.id === postId);
    const isOwn = post?.user_id === user.id;
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      if (isOwn) {
        await fetch(`${API_URL}/posts/${postId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
      } else {
        // Admin delete — bypass ownership check via admin endpoint
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${API_URL}/admin/posts/${postId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      }
    } catch (err) {
      console.error('Delete post error:', err);
    }
  };

  // ---- Comments ----

  const toggleComments = async (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    if (!comments[postId]) {
      setCommentLoading(prev => ({ ...prev, [postId]: true }));
      try {
        const res = await fetch(`${API_URL}/posts/${postId}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(prev => ({ ...prev, [postId]: data }));
        }
      } catch (err) {
        console.error('Fetch comments error:', err);
      } finally {
        setCommentLoading(prev => ({ ...prev, [postId]: false }));
      }
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !commentText[postId]?.trim()) return;
    setCommentSubmitting(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          userAvatarUrl: user.avatarUrl ?? null,
          content: commentText[postId].trim(),
        }),
      });
      if (res.ok) {
        const newComment: PostComment = await res.json();
        setComments(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), newComment] }));
        setCommentText(prev => ({ ...prev, [postId]: '' }));
        // Increment comment count
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
      }
    } catch (err) {
      console.error('Add comment error:', err);
    } finally {
      setCommentSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!user) return;
    setComments(prev => ({ ...prev, [postId]: (prev[postId] ?? []).filter(c => c.id !== commentId) }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
    try {
      await fetch(`${API_URL}/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  return (
    <Box>
      {/* Reference picker dialog */}
      {user && (
        <ReferencePicker
          open={refPickerOpen}
          userId={user.id}
          onSelect={(ref) => { setPostRef(ref); setRefPickerOpen(false); }}
          onClose={() => setRefPickerOpen(false)}
        />
      )}

      {/* Compose box — hidden on profile views */}
      {user && !profileUserId && (
        <Card
          id="dashboard-post-compose"
          sx={{
            mb: 3,
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
          }}
        >
          <CardContent sx={{ pb: '12px !important' }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Avatar src={user.avatarUrl ?? undefined} sx={{ width: 40, height: 40, mt: 0.5 }}>
                {user.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                {isBoard && (
                  <TextField
                    fullWidth
                    placeholder="Title *"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    variant="outlined"
                    size="small"
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        fontWeight: 600,
                      },
                    }}
                  />
                )}
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  placeholder={isBoard ? 'Body (optional)' : "What's on your mind?"}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: 'rgba(255,255,255,0.04)',
                    },
                  }}
                />

                {/* File preview */}
                {file && (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {filePreview ? (
                      <Box
                        component="img"
                        src={filePreview}
                        sx={{ height: 80, borderRadius: '8px', objectFit: 'cover' }}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.75, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                        <InsertDriveFileIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                          {file.name}
                        </Typography>
                      </Box>
                    )}
                    <IconButton size="small" onClick={clearFile}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}

                {/* Reference preview */}
                {postRef && (
                  <Box sx={{ mt: 1 }}>
                    <ReferenceCard reference={postRef} onRemove={() => setPostRef(null)} />
                  </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <IconButton size="small" onClick={() => fileInputRef.current?.click()} sx={{ color: 'text.secondary' }}>
                      <AttachFileIcon fontSize="small" />
                    </IconButton>
                    <Tooltip title="Link a goal, service or post">
                      <IconButton size="small" onClick={() => setRefPickerOpen(true)} sx={{ color: postRef ? 'primary.main' : 'text.secondary' }}>
                        <LinkIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    endIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                    disabled={(isBoard ? !title.trim() : !text.trim()) || submitting}
                    onClick={handleSubmit}
                    sx={{ borderRadius: '8px', fontWeight: 700 }}
                  >
                    {isBoard ? 'Submit' : 'Post'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Posts list */}
      {loadingPosts ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : posts.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          {profileUserId ? 'No posts yet.' : 'No posts yet. Be the first to share something!'}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {posts.map(post => (
            <Card
              key={post.id}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                opacity: (postVotes[post.id]?.score ?? 0) < -5 ? 0.5 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              <CardContent sx={{ pb: '12px !important' }}>
                {/* Post header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Avatar
                    src={post.user_avatar_url ?? undefined}
                    sx={{ width: 36, height: 36, cursor: 'pointer' }}
                    onClick={() => navigate('/profile/' + post.user_id)}
                  >
                    {post.user_name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => navigate('/profile/' + post.user_id)}
                    >
                      {post.user_name}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {formatRelativeTime(post.created_at)}
                    </Typography>
                  </Box>
                  {(user?.id === post.user_id || user?.is_admin) && (
                    <IconButton size="small" onClick={() => handleDeletePost(post.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                {/* Title (board posts) */}
                {post.title && (
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.3, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    {post.title}
                  </Typography>
                )}

                {/* Content */}
                {post.content && (
                  <Typography variant="body2" sx={{ mb: post.media_url ? 1.5 : 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: post.title ? 'text.secondary' : 'text.primary' }}>
                    {renderContentWithMentions(post.content)}
                  </Typography>
                )}

                {/* Media */}
                {post.media_url && post.media_type === 'image' && (
                  <Box
                    component="img"
                    src={post.media_url}
                    sx={{ width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: '10px', mb: 1.5 }}
                  />
                )}
                {post.media_url && post.media_type === 'file' && (
                  <Box
                    component="a"
                    href={post.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.75, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '8px', mb: 1.5, textDecoration: 'none', color: 'text.primary', maxWidth: 'fit-content', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                  >
                    <InsertDriveFileIcon sx={{ fontSize: 18 }} />
                    <Typography variant="caption">Attachment</Typography>
                  </Box>
                )}

                {/* Linked reference */}
                {post.reference && (
                  <Box sx={{ mb: 1.5 }}>
                    <ReferenceCard reference={post.reference} />
                  </Box>
                )}

                {/* Actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  {/* Upvote / Downvote */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleVote(post.id, 1)}
                      sx={{
                        color: postVotes[post.id]?.userVote === 1 ? '#F97316' : 'text.disabled',
                        p: 0.5,
                      }}
                    >
                      <KeyboardArrowUpIcon fontSize="small" />
                    </IconButton>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700, minWidth: 20, textAlign: 'center',
                        color: (postVotes[post.id]?.score ?? 0) > 0
                          ? '#F97316'
                          : (postVotes[post.id]?.score ?? 0) < 0
                          ? '#EF4444'
                          : 'text.disabled',
                      }}
                    >
                      {postVotes[post.id]?.score ?? 0}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleVote(post.id, -1)}
                      sx={{
                        color: postVotes[post.id]?.userVote === -1 ? '#EF4444' : 'text.disabled',
                        p: 0.5,
                      }}
                    >
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Box sx={{ flexGrow: 1 }} />

                  <IconButton size="small" onClick={() => toggleComments(post.id)} sx={{ p: 0.5, color: expandedComments.has(post.id) ? 'primary.main' : 'text.disabled' }}>
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </IconButton>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    {post.comment_count}
                  </Typography>
                </Box>

                {/* Inline comments */}
                <Collapse in={expandedComments.has(post.id)}>
                  <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />

                  {commentLoading[post.id] ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={20} />
                    </Box>
                  ) : (
                    <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                      {(comments[post.id] ?? []).map(comment => (
                        <Box key={comment.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <Avatar src={comment.user_avatar_url ?? undefined} sx={{ width: 28, height: 28, flexShrink: 0 }}>
                            {comment.user_name?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flexGrow: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', px: 1.5, py: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>{comment.user_name}</Typography>
                              {user?.id === comment.user_id && (
                                <IconButton size="small" onClick={() => handleDeleteComment(post.id, comment.id)} sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              )}
                            </Box>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', mt: 0.25, whiteSpace: 'pre-wrap' }}>
                              {comment.content}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  )}

                  {/* Add comment input */}
                  {user && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Avatar src={user.avatarUrl ?? undefined} sx={{ width: 28, height: 28, flexShrink: 0 }}>
                        {user.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add a comment…"
                        value={commentText[post.id] ?? ''}
                        onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(post.id); } }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.04)' } }}
                      />
                      <IconButton
                        size="small"
                        disabled={!commentText[post.id]?.trim() || commentSubmitting[post.id]}
                        onClick={() => handleAddComment(post.id)}
                        sx={{ color: 'primary.main' }}
                      >
                        {commentSubmitting[post.id] ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default PostFeed;
