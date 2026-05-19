import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';

interface OpenBet {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  domain?: string;
  stake_points: number;
  stake_euros?: number;
  is_real_money: boolean;
  deadline: string;
  max_participants: number;
  status: 'open' | 'active' | 'resolved' | 'cancelled';
  created_at: string;
  creator?: { id: string; name: string; avatar_url?: string };
  participant_count: number;
  joined: boolean;
}

interface MyOpenBets {
  created: (OpenBet & { participant_count: number })[];
  joined: (OpenBet & { my_status: string; joined_at: string })[];
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'EXPIRED';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const DOMAINS = [
  'BODY_FITNESS', 'MENTAL_BALANCE', 'INTELLECTUAL_GROWTH', 'FINANCIAL_SECURITY',
  'CAREER_CRAFT', 'FRIENDSHIP_SOCIAL', 'ROMANCE_INTIMACY', 'SPIRIT_PURPOSE',
  'HEALTH_LONGEVITY', 'ENVIRONMENT_HOME', 'IMPACT_LEGACY', 'REST_RECOVERY',
];

// ── Bet card ──────────────────────────────────────────────────────────────────

const OpenBetCard: React.FC<{
  bet: OpenBet;
  userId: string | null;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onCancel: (id: string) => void;
  onResolve: (bet: OpenBet) => void;
  joining: string | null;
}> = ({ bet, userId, onJoin, onLeave, onCancel, onResolve, joining }) => {
  const domainColor = DOMAIN_COLORS[bet.domain || ''] || '#666';
  const domainIcon = DOMAIN_ICONS[bet.domain || ''] || '⚡';
  const isCreator = bet.creator_id === userId;
  const isFull = bet.participant_count >= bet.max_participants;
  const expired = new Date(bet.deadline) <= new Date();
  const isJoining = joining === bet.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-border rounded-lg overflow-hidden"
      style={{ borderLeft: `2px solid ${domainColor}` }}
    >
      <div className="px-3 pt-3 pb-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            {bet.domain && (
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-2xs">{domainIcon}</span>
                <span className="font-mono text-2xs tracking-widest font-bold" style={{ color: domainColor }}>
                  {bet.domain.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            <p className="font-mono text-sm font-bold text-fg leading-tight">{bet.title}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-xs font-black text-amber">
              {bet.is_real_money ? `€${Number(bet.stake_euros).toFixed(0)}` : `${bet.stake_points} PP`}
            </p>
            <p className="font-mono text-2xs text-dim">each</p>
          </div>
        </div>

        {bet.description && (
          <p className="font-mono text-xs text-sub leading-snug mb-1.5 line-clamp-2">{bet.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap text-dim mb-2">
          <span className="font-mono text-2xs">
            👤 {bet.creator?.name?.split(' ')[0] || 'User'}
          </span>
          <span className="font-mono text-2xs">
            {timeAgo(bet.created_at)}
          </span>
          <span className={`font-mono text-2xs font-bold ${expired ? 'text-red' : 'text-sub'}`}>
            ⏱ {timeUntil(bet.deadline)}
          </span>
          <span className="font-mono text-2xs text-sub">
            {bet.participant_count}/{bet.max_participants} in
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isCreator ? (
            <>
              {bet.status === 'open' && (
                <button
                  onClick={() => onCancel(bet.id)}
                  className="px-3 py-1.5 border border-red/30 rounded font-mono text-2xs text-red hover:border-red/60 transition-colors"
                >
                  CANCEL
                </button>
              )}
              {bet.status === 'open' && bet.participant_count > 1 && (
                <button
                  onClick={() => onResolve(bet)}
                  className="flex-1 px-3 py-1.5 bg-amber/10 border border-amber/30 rounded font-mono text-2xs text-amber hover:border-amber/60 transition-colors"
                >
                  RESOLVE
                </button>
              )}
              {bet.status !== 'open' && (
                <span className="font-mono text-2xs text-dim px-2 py-1.5 border border-border rounded">
                  {bet.status.toUpperCase()}
                </span>
              )}
            </>
          ) : bet.joined ? (
            <button
              onClick={() => onLeave(bet.id)}
              className="px-3 py-1.5 border border-border rounded font-mono text-2xs text-dim hover:border-muted transition-colors"
            >
              LEAVE
            </button>
          ) : (
            <button
              onClick={() => onJoin(bet.id)}
              disabled={isJoining || isFull || expired}
              className="flex-1 py-1.5 bg-amber text-bg rounded font-mono text-xs font-black hover:bg-amber/90 transition-colors disabled:opacity-40"
            >
              {isJoining ? 'JOINING…' : isFull ? 'FULL' : expired ? 'EXPIRED' : `JOIN · ${bet.stake_points > 0 ? `${bet.stake_points} PP` : 'FREE'}`}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── Create dialog ─────────────────────────────────────────────────────────────

const CreateDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('');
  const [stakePoints, setStakePoints] = useState(50);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [days, setDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);

  const deadline = new Date(Date.now() + days * 86400000).toISOString();

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Title required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/open-bets', {
        title: title.trim(),
        description: description.trim() || undefined,
        domain: domain || undefined,
        stakePoints,
        deadline,
        maxParticipants,
        isRealMoney: false,
      });
      toast.success('Challenge created!');
      onCreated();
      onClose();
      setTitle(''); setDescription(''); setDomain(''); setStakePoints(50); setDays(7);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create challenge.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className="w-full max-w-lg bg-surface border-t border-border rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-8 h-0.5 bg-muted rounded mx-auto mb-4" />
        <p className="font-mono text-xs font-bold text-amber tracking-widest mb-4">NEW CHALLENGE</p>

        <div className="space-y-3">
          <input
            className="w-full bg-raised border border-border rounded px-3 py-2 font-mono text-sm text-fg placeholder-dim focus:outline-none focus:border-amber/40"
            placeholder="Challenge title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
          />
          <textarea
            className="w-full bg-raised border border-border rounded px-3 py-2 font-mono text-xs text-fg placeholder-dim focus:outline-none focus:border-amber/40 resize-none"
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
          <select
            className="w-full bg-raised border border-border rounded px-3 py-2 font-mono text-xs text-fg focus:outline-none focus:border-amber/40"
            value={domain}
            onChange={e => setDomain(e.target.value)}
          >
            <option value="">No domain</option>
            {DOMAINS.map(d => (
              <option key={d} value={d}>{DOMAIN_ICONS[d] || ''} {d.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <div>
            <p className="font-mono text-2xs text-dim tracking-widest mb-1">STAKE PER PERSON</p>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={500} step={10}
                value={stakePoints}
                onChange={e => setStakePoints(Number(e.target.value))}
                className="flex-1 accent-amber"
              />
              <span className="font-mono text-sm text-amber font-bold w-16 text-right shrink-0">{stakePoints} PP</span>
            </div>
          </div>

          <div>
            <p className="font-mono text-2xs text-dim tracking-widest mb-1">DURATION</p>
            <div className="flex gap-2">
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`flex-1 py-1.5 rounded border font-mono text-xs transition-colors ${days === d ? 'border-amber text-amber' : 'border-border text-dim'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-2xs text-dim tracking-widest mb-1">MAX PARTICIPANTS</p>
            <div className="flex gap-2">
              {[5, 10, 25, 50].map(n => (
                <button
                  key={n}
                  onClick={() => setMaxParticipants(n)}
                  className={`flex-1 py-1.5 rounded border font-mono text-xs transition-colors ${maxParticipants === n ? 'border-amber text-amber' : 'border-border text-dim'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={submitting || !title.trim()}
            className="w-full py-3 bg-amber text-bg font-mono text-sm font-black rounded-lg hover:bg-amber/90 transition-colors disabled:opacity-40"
          >
            {submitting ? 'CREATING…' : `CREATE CHALLENGE · ${stakePoints > 0 ? `${stakePoints} PP stake` : 'FREE'}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Resolve dialog ────────────────────────────────────────────────────────────

const ResolveDialog: React.FC<{
  bet: OpenBet | null;
  onClose: () => void;
  onResolved: () => void;
}> = ({ bet, onClose, onResolved }) => {
  const [participants, setParticipants] = useState<{ user_id: string; name: string; status: string }[]>([]);
  const [winners, setWinners] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!bet) return;
    api.get(`/open-bets/${bet.id}/participants`).then(r => {
      setParticipants(r.data ?? []);
    }).catch(() => {});
  }, [bet?.id]);

  const toggle = (uid: string) => {
    setWinners(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleResolve = async () => {
    if (!bet) return;
    setSubmitting(true);
    try {
      await api.patch(`/open-bets/${bet.id}/resolve`, { winners: Array.from(winners) });
      toast.success('Challenge resolved!');
      onResolved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resolve.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!bet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className="w-full max-w-lg bg-surface border-t border-border rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-8 h-0.5 bg-muted rounded mx-auto mb-4" />
        <p className="font-mono text-xs font-bold text-amber tracking-widest mb-1">RESOLVE CHALLENGE</p>
        <p className="font-mono text-xs text-sub mb-4 line-clamp-1">{bet.title}</p>
        <p className="font-mono text-2xs text-dim mb-3">Select who completed the challenge:</p>

        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {participants.map(p => (
            <button
              key={p.user_id}
              onClick={() => toggle(p.user_id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded border transition-colors text-left ${
                winners.has(p.user_id) ? 'border-green/60 bg-green/5' : 'border-border'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-raised border border-border flex items-center justify-center font-mono text-2xs font-bold text-sub shrink-0">
                {(p.name || 'U')[0].toUpperCase()}
              </div>
              <span className="font-mono text-xs text-fg flex-1">{p.name || 'User'}</span>
              {winners.has(p.user_id) && <span className="font-mono text-2xs text-green">✓ WON</span>}
            </button>
          ))}
        </div>

        <button
          onClick={handleResolve}
          disabled={submitting}
          className="w-full py-3 bg-amber text-bg font-mono text-sm font-black rounded-lg hover:bg-amber/90 transition-colors disabled:opacity-40"
        >
          {submitting ? 'RESOLVING…' : `CONFIRM — ${winners.size} winner${winners.size !== 1 ? 's' : ''}`}
        </button>
      </motion.div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'open' | 'mine';

const OpenBetsPage: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [bets, setBets] = useState<OpenBet[]>([]);
  const [myBets, setMyBets] = useState<MyOpenBets>({ created: [], joined: [] });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<OpenBet | null>(null);
  const [domainFilter, setDomainFilter] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    try {
      const [openRes, mineRes] = await Promise.allSettled([
        api.get(`/open-bets${domainFilter ? `?domain=${domainFilter}` : ''}`),
        api.get('/open-bets/mine'),
      ]);
      if (openRes.status === 'fulfilled') setBets(openRes.value.data ?? []);
      if (mineRes.status === 'fulfilled') setMyBets(mineRes.value.data ?? { created: [], joined: [] });
    } finally {
      setLoading(false);
    }
  }, [domainFilter]);

  useEffect(() => { if (userId) fetchBets(); }, [userId, fetchBets]);

  const handleJoin = async (id: string) => {
    setJoining(id);
    try {
      await api.post(`/open-bets/${id}/join`);
      toast.success('Joined!');
      fetchBets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to join.');
    } finally {
      setJoining(null);
    }
  };

  const handleLeave = async (id: string) => {
    try {
      await api.delete(`/open-bets/${id}/leave`);
      toast.success('Left challenge.');
      fetchBets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to leave.');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.delete(`/open-bets/${id}`);
      toast.success('Challenge cancelled. Stakes refunded.');
      fetchBets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel.');
    }
  };

  const myAll = [...(myBets.created ?? []), ...(myBets.joined ?? [])];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="font-mono text-2xs text-dim tracking-widest">OPEN CHALLENGES</p>
          <p className="font-mono text-xs text-sub">Join or create public bets</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-3 py-1.5 bg-amber text-bg font-mono text-xs font-black rounded-lg hover:bg-amber/90 transition-colors"
        >
          + CREATE
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 px-4 mb-3">
        {(['open', 'mine'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 font-mono text-xs font-bold tracking-widest border-b-2 transition-colors ${
              tab === t ? 'text-amber border-amber' : 'text-dim border-transparent'
            }`}
          >
            {t === 'open' ? `DISCOVER (${bets.length})` : `MINE (${myAll.length})`}
          </button>
        ))}
      </div>

      {/* Domain filter (open tab only) */}
      {tab === 'open' && (
        <div className="px-4 mb-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setDomainFilter('')}
            className={`shrink-0 px-2 py-1 rounded font-mono text-2xs border transition-colors ${!domainFilter ? 'border-amber text-amber' : 'border-border text-dim'}`}
          >
            ALL
          </button>
          {DOMAINS.map(d => (
            <button
              key={d}
              onClick={() => setDomainFilter(domainFilter === d ? '' : d)}
              className={`shrink-0 px-2 py-1 rounded font-mono text-2xs border transition-colors ${domainFilter === d ? 'border-amber text-amber' : 'border-border text-dim'}`}
            >
              {DOMAIN_ICONS[d] || ''} {d.split('_')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 space-y-2">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-28 bg-surface border border-border rounded-lg animate-pulse" />)
        ) : tab === 'open' ? (
          bets.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <p className="font-mono text-xs text-dim">No open challenges. Start one.</p>
              <button onClick={() => setCreateOpen(true)} className="font-mono text-xs text-amber border border-amber/30 rounded px-4 py-2">
                CREATE FIRST
              </button>
            </div>
          ) : (
            bets.map((bet, i) => (
              <motion.div key={bet.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <OpenBetCard
                  bet={bet}
                  userId={userId}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onCancel={handleCancel}
                  onResolve={setResolveTarget}
                  joining={joining}
                />
              </motion.div>
            ))
          )
        ) : (
          myAll.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <p className="font-mono text-xs text-dim">No challenges yet.</p>
              <button onClick={() => setTab('open')} className="font-mono text-xs text-amber border border-amber/30 rounded px-4 py-2">
                FIND CHALLENGES
              </button>
            </div>
          ) : (
            myAll.map((bet: any, i) => (
              <motion.div key={bet.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <OpenBetCard
                  bet={{ ...bet, joined: true }}
                  userId={userId}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onCancel={handleCancel}
                  onResolve={setResolveTarget}
                  joining={joining}
                />
              </motion.div>
            ))
          )
        )}
      </div>

      <AnimatePresence>
        {createOpen && (
          <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchBets} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {resolveTarget && (
          <ResolveDialog bet={resolveTarget} onClose={() => setResolveTarget(null)} onResolved={fetchBets} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OpenBetsPage;
