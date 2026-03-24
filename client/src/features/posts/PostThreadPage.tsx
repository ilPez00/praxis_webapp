import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Avatar,
  CircularProgress,
  Alert,
  Stack,
  TextField,
  IconButton,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import api from '../../lib/api';
import GlassCard from '../../components/common/GlassCard';
import ReferenceCard from '../../components/common/ReferenceCard';
import ContentRenderer from '../../components/common/ContentRenderer';
import { Post, PostComment } from '../../types/api';

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

const PostThreadPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    setLoadingPost(true);
    try {
      const userId = user?.id ? `?userId=${user.id}` : '';
      const res = await api.get(`/posts/${postId}${userId}`);
      setPost(res.data);
    } catch {
      toast.error('Post not found.');
    } finally {
      setLoadingPost(false);
    }
  }, [postId, user?.id]);

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setLoadingComments(true);
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setComments(res.data);
    } finally {
      setLoadingComments(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [fetchPost, fetchComments]);

  const handleLike = async () => {
    if (!user || !post) return;
    const liked = !post.user_liked;
    setPost(prev => prev ? { ...prev, user_liked: liked, like_count: prev.like_count + (liked ? 1 : -1) } : prev);
    try {
      await api.post(`/posts/${post.id}/likes`);
    } catch {
      setPost(prev => prev ? { ...prev, user_liked: !liked, like_count: prev.like_count + (liked ? -1 : 1) } : prev);
    }
  };

  const handleAddComment = async () => {
    if (!user || !post || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/posts/${post.id}/comments`, {
        userName: user.name,
        userAvatarUrl: user.avatarUrl ?? null,
        content: commentText.trim(),
      });
      const newComment: PostComment = res.data;
      setComments(prev => [...prev, newComment]);
      setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
      setCommentText('');
    } catch {
      toast.error('Failed to add comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !post) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    setPost(prev => prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : prev);
    try {
      await api.delete(`/posts/${post.id}/comments/${commentId}`);
    } catch { /* ignore */ }
  };

  if (loadingPost) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!post) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Post not found.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 3, pb: 6 }}>
      {/* Back */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <IconButton size="small" onClick={() => navigate(-1)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="body2" color="text.secondary">Back</Typography>
      </Box>

      {/* Post */}
      <GlassCard glowColor="rgba(245,158,11,0.08)" sx={{ p: 3, mb: 3 }}>
        {/* Author */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Avatar
            src={post.user_avatar_url ?? undefined}
            sx={{ width: 44, height: 44, cursor: 'pointer' }}
            onClick={() => navigate('/profile/' + post.user_id)}
          >
            {post.user_name?.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography
              variant="body1"
              sx={{ fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => navigate('/profile/' + post.user_id)}
            >
              {post.user_name}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {formatRelativeTime(post.created_at)}
            </Typography>
          </Box>
        </Box>

        {/* Title */}
        {post.title && (
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.3 }}>
            {post.title}
          </Typography>
        )}

        {/* Content */}
        {post.content && (
          <ContentRenderer 
            content={post.content}
            sx={{ 
              whiteSpace: 'pre-wrap', 
              lineHeight: 1.7, 
              mb: 1.5, 
              color: post.title ? 'text.secondary' : 'text.primary' 
            }}
          />
        )}

        {/* Media */}
        {post.media_url && post.media_type === 'image' && (
          <Box
            component="img"
            src={post.media_url}
            sx={{ width: '100%', maxHeight: 500, objectFit: 'cover', borderRadius: '10px', mb: 1.5 }}
          />
        )}
        {post.media_url && post.media_type === 'file' && (
          <Box
            component="a"
            href={post.media_url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: '8px', mb: 1.5, textDecoration: 'none', color: 'text.primary', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          >
            <InsertDriveFileIcon sx={{ fontSize: 18 }} />
            <Typography variant="caption">Attachment</Typography>
          </Box>
        )}

        {/* Reference */}
        {post.reference && (
          <Box sx={{ mb: 1.5 }}>
            <ReferenceCard reference={post.reference} />
          </Box>
        )}

        {/* Like */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={handleLike} sx={{ p: 0.5, color: post.user_liked ? '#EF4444' : 'text.disabled' }}>
            {post.user_liked ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{post.like_count}</Typography>
        </Box>
      </GlassCard>

      {/* Comment thread */}
      <GlassCard glowColor="rgba(139,92,246,0.06)" sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
        </Typography>

        {/* Add comment */}
        {user && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 3 }}>
            <Avatar src={user.avatarUrl ?? undefined} sx={{ width: 36, height: 36, flexShrink: 0 }}>
              {user.name?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                placeholder="Write a comment..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddComment(); } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.04)' } }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.75 }}>
                <IconButton
                  size="small"
                  disabled={!commentText.trim() || submitting}
                  onClick={handleAddComment}
                  sx={{ color: 'primary.main' }}
                >
                  {submitting ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                </IconButton>
              </Box>
            </Box>
          </Box>
        )}

        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        {loadingComments ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No comments yet. Be the first to comment!
          </Typography>
        ) : (
          <Stack spacing={2.5}>
            {comments.map(comment => (
              <Box key={comment.id} sx={{ display: 'flex', gap: 1.5 }}>
                <Avatar
                  src={comment.user_avatar_url ?? undefined}
                  sx={{ width: 36, height: 36, flexShrink: 0, cursor: 'pointer' }}
                  onClick={() => navigate('/profile/' + comment.user_id)}
                >
                  {comment.user_name?.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '12px', px: 2, py: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        onClick={() => navigate('/profile/' + comment.user_id)}
                      >
                        {comment.user_name}
                      </Typography>
                      {user?.id === comment.user_id && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteComment(comment.id)}
                          sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      <ContentRenderer content={comment.content} variant="comment" />
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                    {formatRelativeTime(comment.created_at)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </GlassCard>
    </Container>
  );
};

export default PostThreadPage;
