/**
 * useGamificationNotifications Hook
 * Listens for gamification events and shows toast notifications
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface GamificationEvent {
  type: 'level_up' | 'achievement_unlocked' | 'quest_completed';
  user_id: string;
  data: {
    level?: number;
    oldLevel?: number;
    achievement_key?: string;
    achievement_title?: string;
    quest_title?: string;
    xp_earned?: number;
    pp_earned?: number;
  };
}

export const useGamificationNotifications = (userId: string | undefined) => {
  const navigate = useNavigate();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to gamification events
    const channel = supabase.channel(`gamification_${userId}`);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'gamification_events',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const event = payload.new as GamificationEvent;
        handleGamificationEvent(event);
      }
    ).subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, navigate]);

  const handleGamificationEvent = (event: GamificationEvent) => {
    switch (event.type) {
      case 'level_up':
        handleLevelUp(event.data);
        break;
      case 'achievement_unlocked':
        handleAchievement(event.data);
        break;
      case 'quest_completed':
        handleQuestComplete(event.data);
        break;
    }
  };

  const handleLevelUp = (data: { level?: number; oldLevel?: number; xp_earned?: number }) => {
    const level = data.level || data.oldLevel || 1;
    
    // Get tier name
    const getTier = (lvl: number) => {
      if (lvl >= 50) return 'Diamond';
      if (lvl >= 20) return 'Platinum';
      if (lvl >= 10) return 'Gold';
      if (lvl >= 5) return 'Silver';
      return 'Bronze';
    };

    const oldTier = getTier(data.oldLevel || 1);
    const newTier = getTier(level);
    const tierChanged = oldTier !== newTier;

    toast.success(
      (t) => (
        <div onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>
            🎉 LEVEL UP!
          </div>
          <div style={{ fontSize: '0.9rem' }}>
            Level {data.oldLevel} → {level}
            {tierChanged && (
              <div style={{ color: '#F59E0B', fontWeight: 700, marginTop: '4px' }}>
                {newTier} League Unlocked!
              </div>
            )}
          </div>
        </div>
      ),
      {
        duration: 5000,
        style: {
          background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
          color: '#fff',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(167,139,250,0.4)',
        },
      }
    );
  };

  const handleAchievement = (data: { achievement_key?: string; achievement_title?: string; xp_earned?: number; pp_earned?: number }) => {
    toast.success(
      (t) => (
        <div onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>
            🏆 Achievement Unlocked!
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{data.achievement_title}</div>
          <div style={{ fontSize: '0.85rem', marginTop: '4px', opacity: 0.9 }}>
            +{data.xp_earned} XP | +{data.pp_earned} PP
          </div>
        </div>
      ),
      {
        duration: 4000,
        style: {
          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          color: '#fff',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(245,158,11,0.4)',
        },
      }
    );
  };

  const handleQuestComplete = (data: { quest_title?: string; xp_earned?: number; pp_earned?: number }) => {
    toast.success(
      (t) => (
        <div onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px' }}>
            ✅ Quest Completed!
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{data.quest_title}</div>
          <div style={{ fontSize: '0.85rem', marginTop: '4px', opacity: 0.9 }}>
            +{data.xp_earned} XP | +{data.pp_earned} PP
          </div>
        </div>
      ),
      {
        duration: 3000,
        style: {
          background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
          color: '#fff',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(34,197,94,0.4)',
        },
      }
    );
  };
};
