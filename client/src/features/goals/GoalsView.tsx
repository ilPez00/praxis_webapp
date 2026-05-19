import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import AxiomBriefStrip from './AxiomBriefStrip';
import GoalCard from './GoalCard';

interface RawGoal {
  id: string;
  name: string;
  domain?: string;
  progress: number;
  deadline?: string;
  parentId?: string;
  status?: string;
}

interface Bet {
  id: string;
  goal_node_id: string;
  goal_name: string;
  stake_points: number;
  stake_euros?: number;
  is_real_money?: boolean;
  deadline: string;
  status: string;
}

const GoalsView: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [goals, setGoals] = useState<RawGoal[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefGoalId, setBriefGoalId] = useState<string | null>(null);
  const [briefAction, setBriefAction] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [goalsRes, betsRes, briefRes] = await Promise.allSettled([
        api.get(`/goals/${userId}`),
        api.get(`/bets/${userId}`),
        api.get('/axiom/morning-brief'),
      ]);

      if (goalsRes.status === 'fulfilled') {
        const nodes: RawGoal[] = Array.isArray(goalsRes.value.data?.nodes)
          ? goalsRes.value.data.nodes
          : [];
        // Only leaf/active goals (no parentId or top-level), progress < 100
        const active = nodes.filter(n => (n.progress ?? 0) < 1 && n.status !== 'completed');
        setGoals(active);
      }

      if (betsRes.status === 'fulfilled') {
        const activeBets = (Array.isArray(betsRes.value.data) ? betsRes.value.data : [])
          .filter((b: Bet) => b.status === 'active' || b.status === 'pending');
        setBets(activeBets);
      }

      if (briefRes.status === 'fulfilled' && briefRes.value.data?.brief) {
        const brief = briefRes.value.data.brief;
        setBriefGoalId(brief.priority?.id ?? null);
        setBriefAction(brief.action ?? null);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchData();
  }, [userId, fetchData]);

  if (userLoading || loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-surface border border-border rounded-lg animate-pulse mx-0" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="font-mono text-sub text-sm">Not signed in.</p>
        <button onClick={() => navigate('/login')} className="font-mono text-xs text-amber border border-amber/30 rounded px-4 py-2">
          SIGN IN
        </button>
      </div>
    );
  }

  const betByGoalId = Object.fromEntries(
    bets.map(b => [b.goal_node_id, b])
  );

  return (
    <div className="pb-20">
      {/* Morning brief */}
      <AxiomBriefStrip />

      {/* Goal list */}
      <div className="mt-3 space-y-2">
        {goals.length === 0 ? (
          <div className="mx-4 flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <p className="font-mono text-xs text-dim text-center">No active goals.<br />Set your first intention.</p>
            <button
              onClick={() => navigate('/goal-selection')}
              className="font-mono text-xs font-bold text-amber border border-amber/30 rounded-lg px-5 py-2.5 hover:border-amber/60 transition-colors"
            >
              + ADD GOAL
            </button>
          </div>
        ) : (
          <>
            {goals.map((goal, i) => (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GoalCard
                  goal={{ ...goal, progress: Math.round((goal.progress ?? 0) * 100) }}
                  axiomAction={goal.id === briefGoalId && briefAction ? briefAction : undefined}
                  bet={betByGoalId[goal.id]}
                  userId={userId!}
                  onCheckIn={fetchData}
                />
              </motion.div>
            ))}

            {/* Add goal CTA */}
            <div className="mx-4 mt-2">
              <button
                onClick={() => navigate('/goal-selection')}
                className="w-full border border-dashed border-muted hover:border-amber/30 rounded-lg py-3 font-mono text-xs text-dim hover:text-amber transition-colors"
              >
                + ADD GOAL
              </button>
            </div>
          </>
        )}
      </div>

      {/* Commitments strip — if active bets without matching goal */}
      {bets.filter(b => !betByGoalId[b.goal_node_id]).length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-surface border border-green/20 rounded-lg">
          <p className="font-mono text-2xs text-green font-bold tracking-widest mb-1">COMMITMENTS</p>
          <div className="space-y-1">
            {bets.filter(b => !betByGoalId[b.goal_node_id]).map(bet => (
              <button
                key={bet.id}
                onClick={() => navigate('/commitments')}
                className="w-full flex justify-between items-center text-left"
              >
                <span className="font-mono text-xs text-fg truncate">{bet.goal_name}</span>
                <span className="font-mono text-xs font-bold text-green shrink-0 ml-2">
                  {bet.is_real_money ? `€${Number(bet.stake_euros).toFixed(0)}` : `${bet.stake_points} PP`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsView;
