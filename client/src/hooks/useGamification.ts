/**
 * useGamification Hook
 * Provides gamification data and actions
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import hotToast from 'react-hot-toast';

export interface GamificationProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  level: number;
  total_xp: number;
  praxis_points: number;
  league: string;
  reputation_score: number;
  equipped_title: string | null;
  profile_theme: string;
  current_streak: number;
  badge: string | null;
  xp_progress: number;
  xp_needed: number;
  xp_percent: number;
}

interface Quest {
  quest_id: string;
  quest_type: string;
  title: string;
  description: string;
  xp_reward: number;
  pp_reward: number;
  difficulty: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

interface Achievement {
  achievement_key: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

interface UseGamificationReturn {
  profile: GamificationProfile | null;
  quests: Quest[];
  achievements: Achievement[];
  loading: boolean;
  refresh: () => Promise<void>;
  trackAction: (actionType: string, amount?: number) => Promise<void>;
}

export const useGamification = (userId: string): UseGamificationReturn => {
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGamificationData = useCallback(async (signal?: AbortSignal) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const [profileRes, questsRes, achievementsRes] = await Promise.all([
        api.get('/gamification/profile', { params: { userId }, signal }),
        api.get('/gamification/quests', { signal }),
        api.get('/gamification/achievements', { params: { userId }, signal }),
      ]);

      setProfile(profileRes.data.profile);
      setQuests(questsRes.data.quests || []);
      setAchievements(achievementsRes.data.achievements || []);
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Failed to fetch gamification data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGamificationData(controller.signal);
    return () => controller.abort();
  }, [fetchGamificationData]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchGamificationData();
  }, [fetchGamificationData]);

  const trackAction = useCallback(async (actionType: string, amount = 1) => {
    try {
      const { data } = await api.post('/gamification/social/track', {
        actionType,
        amount,
      });

      if (data.success && data.pp_earned > 0) {
        // Could trigger PP toast here
        console.log(`Earned ${data.pp_earned} PP and ${data.xp_earned} XP`);
        
        if (data.leveled_up) {
          hotToast.success(`Level Up! You reached level ${data.new_level}!`);
          // Refresh to get updated profile
          await fetchGamificationData();
        }
      }
    } catch (error: any) {
      if (error.response?.data?.reason === 'daily_limit_reached') {
        console.log('Daily limit reached for this action');
      } else {
        console.error('Failed to track action:', error);
      }
    }
  }, [fetchGamificationData]);

  return {
    profile,
    quests,
    achievements,
    loading,
    refresh: fetchGamificationData,
    trackAction,
  };
};
