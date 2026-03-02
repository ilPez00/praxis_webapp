import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';

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
  created_at: string;
  like_count: number;
  comment_count: number;
  user_liked: boolean;
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

const PostFeed: React.FC<Props> = ({ context, isBoard = false }) => {
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Compose state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Per-post comment state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const userId = user?.id ? `&userId=${user.id}` : '';
      const res = await fetch(`${API_URL}/posts?context=${context}${userId}`);
      if (res.ok) setPosts(await res.json());
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  }, [context, user?.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
      // Fire-and-forget Roshi brief refresh
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch(`${API_URL}/ai-coaching/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Post submit error:', err);
      toast.error(err.message || 'Failed to post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Like toggle ----

  const handleLike = async (postId: string) => {
    if (!user) return;
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const liked = !p.user_liked;
      return { ...p, user_liked: liked, like_count: p.like_count + (liked ? 1 : -1) };
    }));
    try {
      await fetch(`${API_URL}/posts/${postId}/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (err) {
      // Revert on failure
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const liked = !p.user_liked;
        return { ...p, user_liked: liked, like_count: p.like_count + (liked ? 1 : -1) };
      }));
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
      {/* Compose box */}
      {user && (
        <Card
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

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
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
          No posts yet. Be the first to share something!
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
              }}
            >
              <CardContent sx={{ pb: '12px !important' }}>
                {/* Post header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <Avatar src={post.user_avatar_url ?? undefined} sx={{ width: 36, height: 36 }}>
                    {post.user_name?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{post.user_name}</Typography>
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
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.3 }}>
                    {post.title}
                  </Typography>
                )}

                {/* Content */}
                {post.content && (
                  <Typography variant="body2" sx={{ mb: post.media_url ? 1.5 : 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: post.title ? 'text.secondary' : 'text.primary' }}>
                    {post.content}
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

                {/* Actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <IconButton size="small" onClick={() => handleLike(post.id)} sx={{ p: 0.5, color: post.user_liked ? '#EF4444' : 'text.disabled' }}>
                    {post.user_liked ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                  </IconButton>
                  <Typography variant="caption" sx={{ mr: 1.5, fontWeight: 600 }}>{post.like_count}</Typography>

                  <IconButton size="small" onClick={() => toggleComments(post.id)} sx={{ p: 0.5, color: expandedComments.has(post.id) ? 'primary.main' : 'text.disabled' }}>
                    <ChatBubbleOutlineIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{post.comment_count}</Typography>
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
