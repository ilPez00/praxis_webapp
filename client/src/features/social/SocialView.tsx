import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

interface Post {
  id: string;
  user_name: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  context?: string;
  likes_count?: number;
}

interface Match {
  id: string;
  name: string;
  avatar_url?: string;
  score: number;
  domains?: string[];
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const QuickLinks: React.FC = () => {
  const navigate = useNavigate();
  const links = [
    { label: 'DMs', icon: '💬', path: '/chat' },
    { label: 'GROUPS', icon: '👥', path: '/groups' },
    { label: 'FRIENDS', icon: '🤝', path: '/friends' },
    { label: 'PLACES', icon: '📍', path: '/places' },
    { label: 'SEARCH', icon: '🔍', path: '/search' },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-1">
      {links.map(l => (
        <button
          key={l.path}
          onClick={() => navigate(l.path)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-full font-mono text-2xs text-sub hover:border-muted hover:text-fg transition-colors"
        >
          <span>{l.icon}</span>
          <span className="tracking-widest font-bold">{l.label}</span>
        </button>
      ))}
    </div>
  );
};

const SocialView: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    Promise.allSettled([
      api.get('/posts?limit=20'),
      api.get(`/matches/${userId}?limit=5`),
    ]).then(([postsRes, matchesRes]) => {
      if (postsRes.status === 'fulfilled') {
        const data = postsRes.value.data;
        setPosts(Array.isArray(data) ? data : Array.isArray(data?.posts) ? data.posts : []);
      }
      if (matchesRes.status === 'fulfilled') {
        const data = matchesRes.value.data;
        setMatches(Array.isArray(data) ? data.slice(0, 5) : []);
      }
    }).finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="pb-20">
      {/* Quick links: DMs, Groups, Friends, Places, Search */}
      <div className="mt-3 mb-3">
        <QuickLinks />
      </div>

      {/* Matches strip */}
      {matches.length > 0 && (
        <div className="mx-4 mb-3">
          <p className="font-mono text-2xs text-dim tracking-widest mb-2">MATCHES</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {matches.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`/profile/${m.id}`)}
                className="flex-shrink-0 flex flex-col items-center gap-1 bg-surface border border-border rounded-lg px-3 py-2 w-20"
              >
                <div className="w-9 h-9 rounded-full bg-raised border border-border flex items-center justify-center overflow-hidden">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-mono text-xs font-bold text-sub">
                      {(m.name || 'U')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="font-mono text-2xs text-fg text-center leading-tight line-clamp-1 w-full">
                  {m.name?.split(' ')[0] || 'User'}
                </span>
                <span className="font-mono text-2xs text-amber font-bold">
                  {Math.round((m.score ?? 0) * 100)}%
                </span>
              </button>
            ))}
            <button
              onClick={() => navigate('/matches')}
              className="flex-shrink-0 flex flex-col items-center gap-1 bg-surface border border-dashed border-muted rounded-lg px-3 py-2 w-20"
            >
              <div className="w-9 h-9 rounded-full border border-dashed border-muted flex items-center justify-center">
                <span className="font-mono text-lg text-dim">+</span>
              </div>
              <span className="font-mono text-2xs text-dim">more</span>
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="mx-4">
        <p className="font-mono text-2xs text-dim tracking-widest mb-2">FEED</p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface border border-border rounded-lg animate-pulse" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <p className="font-mono text-xs text-dim">No activity yet. Find your people.</p>
            <button onClick={() => navigate('/discover')} className="font-mono text-xs text-amber border border-amber/30 rounded px-4 py-2">
              DISCOVER
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((post, i) => (
              <motion.button
                key={post.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/posts/${post.id}`)}
                className="w-full bg-surface border border-border rounded-lg p-3 text-left hover:border-muted transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-raised border border-border flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                    {post.avatar_url ? (
                      <img src={post.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-mono text-2xs font-bold text-sub">
                        {(post.user_name || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-fg">{post.user_name}</span>
                      <span className="font-mono text-2xs text-dim">{timeAgo(post.created_at)}</span>
                    </div>
                    <p className="font-mono text-xs text-sub leading-relaxed line-clamp-3">
                      {post.content}
                    </p>
                    {post.likes_count !== undefined && post.likes_count > 0 && (
                      <p className="font-mono text-2xs text-dim mt-1">♥ {post.likes_count}</p>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialView;
