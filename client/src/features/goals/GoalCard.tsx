import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

interface Bet {
  id: string;
  stake_points: number;
  stake_euros?: number;
  is_real_money?: boolean;
  deadline: string;
  status: string;
}

interface GoalCardProps {
  goal: {
    id: string;
    name?: string;
    title?: string;
    domain?: string;
    progress: number;      // 0-100
    deadline?: string;
    targetDate?: string;
    streak?: number;
  };
  axiomAction?: string;   // from morning brief if this goal is priority
  bet?: Bet;
  userId: string;
  onCheckIn?: () => void;
}

function daysLeft(date?: string): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, axiomAction, bet, userId, onCheckIn }) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [localProgress, setLocalProgress] = useState(goal.progress);

  const name = goal.name || goal.title || 'Untitled';
  const domain = goal.domain || 'defaultDomain';
  const domainColor = DOMAIN_COLORS[domain] || '#9CA3AF';
  const domainIcon = DOMAIN_ICONS[domain] || '🎯';
  const deadline = goal.deadline || goal.targetDate;
  const days = daysLeft(deadline);
  const deadlineUrgent = days !== null && days <= 7;

  const handleCheckIn = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await api.post('/checkins', {
        goalId: goal.id,
        goalNodeId: goal.id,
        progressDelta: 0.05,
        grade: null,
        notes: notes.trim() || null,
        actorType: 'user',
      });
      setLocalProgress(p => Math.min(100, p + 5));
      setCheckinOpen(false);
      setNotes('');
      toast.success('Check-in recorded!');
      onCheckIn?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Check-in failed.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <motion.div
      layout
      className="mx-4 bg-surface border border-border rounded-lg overflow-hidden"
      style={{ borderLeft: `2px solid ${domainColor}` }}
    >
      {/* Main row */}
      <div
        className="px-3 pt-3 pb-2 cursor-pointer"
        onClick={() => navigate(`/goals`)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs">{domainIcon}</span>
              <span className="font-mono text-2xs tracking-widest font-bold" style={{ color: domainColor }}>
                {domain.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="font-mono text-sm font-bold text-fg leading-tight truncate">{name}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-mono text-xl font-black" style={{ color: domainColor }}>
              {localProgress}%
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-2.5">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: domainColor }}
            initial={{ width: 0 }}
            animate={{ width: `${localProgress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {/* Axiom action */}
        {axiomAction && (
          <div className="mb-2 px-2 py-1.5 bg-amber/5 border border-amber/15 rounded">
            <span className="font-mono text-2xs text-amber font-bold tracking-widest">TODAY  </span>
            <span className="font-mono text-xs text-fg">{axiomAction}</span>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {days !== null && (
            <span className={`font-mono text-2xs font-bold ${deadlineUrgent ? 'text-red' : 'text-dim'}`}>
              {days > 0 ? `${days}d left` : days === 0 ? 'TODAY' : 'OVERDUE'}
            </span>
          )}
          {bet && (
            <span className="font-mono text-2xs font-bold text-green bg-green/10 border border-green/20 rounded px-1.5 py-0.5">
              {bet.is_real_money ? `€${Number(bet.stake_euros).toFixed(0)} staked` : `${bet.stake_points} PP staked`}
            </span>
          )}
          {deadlineUrgent && (
            <span className="font-mono text-2xs text-red">⚡ deadline critical</span>
          )}
        </div>
      </div>

      {/* Check-in area */}
      <div className="px-3 pb-3">
        <AnimatePresence>
          {checkinOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <input
                className="w-full bg-raised border border-border rounded px-3 py-2 font-mono text-xs text-fg placeholder-dim mb-2 focus:outline-none focus:border-amber/40"
                placeholder="notes (optional)"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCheckIn()}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCheckIn}
                  disabled={checking}
                  className="flex-1 bg-amber/90 hover:bg-amber text-bg font-mono text-xs font-black py-2 rounded transition-colors disabled:opacity-50"
                >
                  {checking ? 'SAVING…' : '✓ DONE'}
                </button>
                <button
                  onClick={() => setCheckinOpen(false)}
                  className="px-3 py-2 border border-border rounded font-mono text-xs text-dim hover:text-fg transition-colors"
                >
                  ×
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={e => { e.stopPropagation(); setCheckinOpen(true); }}
              className="mt-2 w-full border border-dashed border-muted hover:border-amber/40 rounded py-2 font-mono text-xs text-dim hover:text-amber transition-colors"
            >
              + CHECK IN
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default GoalCard;
