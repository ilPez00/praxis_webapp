import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import { useGamification } from '../hooks/useGamification';

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { profile } = useGamification(user?.id || '');

  const pp = profile?.praxis_points ?? user?.praxis_points ?? 0;
  const streak = profile?.current_streak ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-bg border-b border-border flex items-center justify-between px-4 h-12">
      <span className="font-mono font-black tracking-widest text-base text-fg">PRAXIS</span>
      <div className="flex items-center gap-3">
        {streak > 0 && (
          <button onClick={() => navigate('/analytics')} className="font-mono text-xs text-amber font-bold tracking-wide">
            🔥 {streak}d
          </button>
        )}
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-1 bg-raised border border-border rounded-md px-2 py-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B" className="shrink-0">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span className="font-mono text-xs font-black text-amber">{pp.toLocaleString()}</span>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-7 h-7 rounded-full bg-raised border border-border flex items-center justify-center overflow-hidden"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-mono text-xs text-sub font-bold">
              {(user?.name || 'U')[0].toUpperCase()}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default TopBar;
