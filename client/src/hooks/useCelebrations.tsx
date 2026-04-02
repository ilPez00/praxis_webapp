import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import MilestoneCelebrationModal from '../components/common/MilestoneCelebrationModal';
import Confetti from 'react-confetti';

interface MysteryReward {
  tier: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  amount: number;
  emoji: string;
}

interface MilestoneData {
  milestone: number;
  type: 'streak' | 'achievement' | 'level';
  title: string;
  description?: string;
  reward?: { pp?: number; xp?: number; badge?: string };
}

interface CelebrationContextType {
  celebrateMilestone: (data: MilestoneData) => void;
  celebrateMysteryReward: (reward: MysteryReward) => void;
  celebrateLevelUp: (oldLevel: number, newLevel: number) => void;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

export const useCelebrations = () => {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebrations must be used within CelebrationProvider');
  return ctx;
};

const TIER_CONFETTI: Record<string, { count: number; colors: string[]; duration: number }> = {
  Common:    { count: 100, colors: ['#6B7280', '#9CA3AF', '#D1D5DB'], duration: 2000 },
  Rare:      { count: 200, colors: ['#3B82F6', '#60A5FA', '#93C5FD'], duration: 2500 },
  Epic:      { count: 350, colors: ['#8B5CF6', '#A78BFA', '#C4B5FD', '#F59E0B'], duration: 3000 },
  Legendary: { count: 500, colors: ['#F59E0B', '#FBBF24', '#A78BFA', '#EC4899', '#F97316'], duration: 4000 },
};

const STREAK_MILESTONES = [7, 14, 30, 60, 90, 100, 180, 365];

export const CelebrationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<MilestoneData | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [confettiConfig, setConfettiConfig] = useState({ count: 300, colors: ['#F59E0B', '#A78BFA', '#FBBF24'] });
  const [confettiTimer, setConfettiTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const stopConfetti = useCallback(() => {
    if (confettiTimer) clearTimeout(confettiTimer);
    setConfettiActive(false);
    setConfettiTimer(null);
  }, [confettiTimer]);

  const celebrateMilestone = useCallback((data: MilestoneData) => {
    setModalData(data);
    setModalOpen(true);
    setConfettiActive(true);
    const config = TIER_CONFETTI.Epic;
    setConfettiConfig({ count: config.count, colors: config.colors });
    const timer = setTimeout(stopConfetti, config.duration);
    setConfettiTimer(timer);
  }, [stopConfetti]);

  const celebrateMysteryReward = useCallback((reward: MysteryReward) => {
    const config = TIER_CONFETTI[reward.tier];
    setConfettiActive(true);
    setConfettiConfig({ count: config.count, colors: config.colors });
    const timer = setTimeout(stopConfetti, config.duration);
    setConfettiTimer(timer);
  }, [stopConfetti]);

  const celebrateLevelUp = useCallback((oldLevel: number, newLevel: number) => {
    const isTierChange = (lvl: number) => [5, 10, 20, 50].includes(lvl);
    
    if (isTierChange(newLevel)) {
      const tierNames: Record<number, string> = { 5: 'Silver', 10: 'Gold', 20: 'Platinum', 50: 'Diamond' };
      const colors: Record<number, string> = { 5: '#F59E0B', 10: '#FBBF24', 20: '#A78BFA', 50: '#06B6D4' };
      const tierColor = colors[newLevel];
      
      setModalData({
        milestone: newLevel,
        type: 'level',
        title: `${tierNames[newLevel]} Tier Unlocked!`,
        description: `You've reached Level ${newLevel}!`,
        reward: { xp: (newLevel - oldLevel) * 100 },
      });
      setModalOpen(true);
      setConfettiActive(true);
      setConfettiConfig({ count: 600, colors: [tierColor, '#F59E0B', '#fff', '#A78BFA'] });
      const timer = setTimeout(stopConfetti, 4000);
      setConfettiTimer(timer);
    }
  }, [stopConfetti]);

  const handleModalClose = () => {
    setModalOpen(false);
    setConfettiActive(false);
    if (confettiTimer) clearTimeout(confettiTimer);
    setConfettiTimer(null);
  };

  return (
    <CelebrationContext.Provider value={{ celebrateMilestone, celebrateMysteryReward, celebrateLevelUp }}>
      {children}
      
      {/* Confetti overlay */}
      {confettiActive && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9998, pointerEvents: 'none' }}>
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={confettiConfig.count}
            gravity={0.12}
            colors={confettiConfig.colors}
            onConfettiComplete={stopConfetti}
          />
        </div>
      )}
      
      {/* Milestone/Level celebration modal */}
      <MilestoneCelebrationModal
        open={modalOpen}
        milestone={modalData?.milestone || 0}
        type={modalData?.type || 'streak'}
        title={modalData?.title || ''}
        description={modalData?.description}
        reward={modalData?.reward}
        onClose={handleModalClose}
      />
    </CelebrationContext.Provider>
  );
};

export const isStreakMilestone = (streak: number): boolean => STREAK_MILESTONES.includes(streak);

export const getMilestoneConfig = (streak: number): { emoji: string; title: string; description: string } => {
  const configs: Record<number, { emoji: string; title: string; description: string }> = {
    7:   { emoji: '🏆', title: 'One Week Strong!', description: 'You\'ve checked in 7 days in a row. Discipline is forming!' },
    14:  { emoji: '🔥', title: 'Two Weeks of Fire!', description: 'Half a month! You\'re building an unstoppable habit.' },
    30:  { emoji: '💎', title: 'One Month Diamond!', description: '30 days! You\'re in the top 5% of all Praxis users.' },
    60:  { emoji: '⚡', title: 'Two Months!', description: '60 days of consistency. You\'re a machine.' },
    90:  { emoji: '👑', title: 'Quarter Year Champion!', description: '90 days! Your streak is legendary.' },
    100: { emoji: '🌟', title: 'CENTURY!', description: '100 days! This isn\'t a habit anymore — it\'s your identity.' },
    180: { emoji: '🚀', title: 'Half Year Hero!', description: '180 days! You\'ve achieved what <1% ever do.' },
    365: { emoji: '🏔️', title: 'ONE FULL YEAR!', description: '365 days. You are the definition of unstoppable.' },
  };
  return configs[streak] || { emoji: '🎉', title: 'Milestone Reached!', description: 'Keep going!' };
};
