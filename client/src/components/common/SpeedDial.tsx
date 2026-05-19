import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import AxiomQueryDialog from '../../features/notebook/AxiomQueryDialog';

interface Action {
  key: string;
  icon: string;
  label: string;
  color?: string;
}

const ACTIONS: Action[] = [
  { key: 'log',   icon: '📝', label: 'LOG',    color: '#A78BFA' },
  { key: 'post',  icon: '📣', label: 'POST',   color: '#3B82F6' },
  { key: 'bet',   icon: '⚡', label: 'BET',    color: '#F59E0B' },
  { key: 'chat',  icon: '💬', label: 'CHAT',   color: '#22C55E' },
  { key: 'axiom', icon: '🤖', label: 'AXIOM',  color: '#EF4444' },
];

// ── Quick-log sheet ───────────────────────────────────────────────────────────
const LogSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [content, setContent] = useState('');
  const [type, setType] = useState('note');
  const [submitting, setSubmitting] = useState(false);

  const TYPES = [
    { key: 'note', label: '📝 Note' },
    { key: 'goal', label: '🎯 Goal update' },
    { key: 'achievement', label: '🏆 Win' },
    { key: 'mood', label: '😊 Mood' },
    { key: 'voice_note', label: '🎤 Voice note' },
  ];

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/diary/entries', { content: content.trim(), entry_type: type, is_private: true });
      toast.success('Logged to diary!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to log.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <p className="font-mono text-xs font-bold text-amber tracking-widest mb-3">QUICK LOG</p>
      <div className="flex gap-1 flex-wrap mb-3">
        {TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`px-2 py-1 rounded border font-mono text-2xs transition-colors ${type === t.key ? 'border-amber text-amber' : 'border-border text-dim'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        autoFocus
        className="w-full bg-raised border border-border rounded px-3 py-2 font-mono text-sm text-fg placeholder-dim focus:outline-none focus:border-amber/40 resize-none mb-3"
        placeholder="What happened?"
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={4}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !content.trim()}
        className="w-full py-2.5 bg-amber text-bg font-mono text-sm font-black rounded-lg disabled:opacity-40"
      >
        {submitting ? 'SAVING…' : 'LOG IT'}
      </button>
    </Sheet>
  );
};

// ── Quick-post sheet ──────────────────────────────────────────────────────────
const PostSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/posts', { content: content.trim() });
      toast.success('Posted!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to post.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <p className="font-mono text-xs font-bold text-blue-400 tracking-widest mb-3">NEW POST</p>
      <textarea
        autoFocus
        className="w-full bg-raised border border-border rounded px-3 py-2 font-mono text-sm text-fg placeholder-dim focus:outline-none focus:border-blue-400/40 resize-none mb-3"
        placeholder="What's on your mind?"
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={5}
        maxLength={1000}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
      />
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-2xs text-dim">{content.length}/1000</span>
        <span className="font-mono text-2xs text-dim">⌘+Enter to post</span>
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting || !content.trim()}
        className="w-full py-2.5 bg-blue-500 text-white font-mono text-sm font-black rounded-lg disabled:opacity-40"
      >
        {submitting ? 'POSTING…' : 'POST'}
      </button>
    </Sheet>
  );
};

// ── Quick-bet sheet ───────────────────────────────────────────────────────────
const BetSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  return (
    <Sheet onClose={onClose}>
      <p className="font-mono text-xs font-bold text-amber tracking-widest mb-3">NEW BET</p>
      <div className="space-y-2">
        <button
          onClick={() => { navigate('/commitments'); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-3 bg-raised border border-border rounded-lg hover:border-amber/30 transition-colors text-left"
        >
          <span className="text-lg">🎯</span>
          <div>
            <p className="font-mono text-xs font-bold text-fg">Solo Pledge</p>
            <p className="font-mono text-2xs text-dim">Bet PP on your own goal</p>
          </div>
        </button>
        <button
          onClick={() => { navigate('/open-bets'); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-3 bg-raised border border-border rounded-lg hover:border-amber/30 transition-colors text-left"
        >
          <span className="text-lg">⚡</span>
          <div>
            <p className="font-mono text-xs font-bold text-fg">Open Challenge</p>
            <p className="font-mono text-2xs text-dim">Create a public bet anyone joins</p>
          </div>
        </button>
        <button
          onClick={() => { navigate('/open-bets'); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-3 bg-raised border border-border rounded-lg hover:border-amber/30 transition-colors text-left"
        >
          <span className="text-lg">🔍</span>
          <div>
            <p className="font-mono text-xs font-bold text-fg">Browse Challenges</p>
            <p className="font-mono text-2xs text-dim">Find open bets to join</p>
          </div>
        </button>
      </div>
    </Sheet>
  );
};

// ── Quick-chat sheet ──────────────────────────────────────────────────────────
const ChatSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  return (
    <Sheet onClose={onClose}>
      <p className="font-mono text-xs font-bold text-green tracking-widest mb-3">MESSAGE</p>
      <div className="space-y-2">
        <button
          onClick={() => { navigate('/chat'); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-3 bg-raised border border-border rounded-lg hover:border-green/30 transition-colors text-left"
        >
          <span className="text-lg">💬</span>
          <div>
            <p className="font-mono text-xs font-bold text-fg">Direct Messages</p>
            <p className="font-mono text-2xs text-dim">Private 1:1 conversations</p>
          </div>
        </button>
        <button
          onClick={() => { navigate('/groups'); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-3 bg-raised border border-border rounded-lg hover:border-green/30 transition-colors text-left"
        >
          <span className="text-lg">👥</span>
          <div>
            <p className="font-mono text-xs font-bold text-fg">Group Rooms</p>
            <p className="font-mono text-2xs text-dim">Accountability pods</p>
          </div>
        </button>
      </div>
    </Sheet>
  );
};

// ── Shared bottom sheet wrapper ───────────────────────────────────────────────
const Sheet: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="w-full max-w-lg bg-surface border-t border-border rounded-t-2xl p-4 pb-10"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-8 h-0.5 bg-muted rounded mx-auto mb-4" />
      {children}
    </motion.div>
  </div>
);

// ── Main SpeedDial ────────────────────────────────────────────────────────────
type SheetKey = 'log' | 'post' | 'bet' | 'chat' | null;

const SpeedDial: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [axiomOpen, setAxiomOpen] = useState(false);

  const handleAction = (key: string) => {
    setOpen(false);
    if (key === 'axiom') { setAxiomOpen(true); return; }
    setSheet(key as SheetKey);
  };

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-16 right-4 z-40">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute bottom-14 right-0 flex flex-col items-end gap-2"
            >
              {ACTIONS.map((action, i) => (
                <motion.button
                  key={action.key}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleAction(action.key)}
                  className="flex items-center gap-2 bg-surface border border-border rounded-full pl-3 pr-4 py-2 shadow-lg hover:border-muted transition-colors"
                >
                  <span className="text-base">{action.icon}</span>
                  <span className="font-mono text-2xs font-bold tracking-widest" style={{ color: action.color }}>
                    {action.label}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backdrop */}
        {open && (
          <div className="fixed inset-0 z-[-1]" onClick={() => setOpen(false)} />
        )}

        <button
          onClick={() => setOpen(o => !o)}
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-all ${
            open ? 'bg-raised border-amber rotate-45' : 'bg-surface border-border'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={open ? '#F59E0B' : '#aaa'} strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Sheets */}
      <AnimatePresence>
        {sheet === 'log' && <LogSheet onClose={() => setSheet(null)} />}
        {sheet === 'post' && <PostSheet onClose={() => setSheet(null)} />}
        {sheet === 'bet' && <BetSheet onClose={() => setSheet(null)} />}
        {sheet === 'chat' && <ChatSheet onClose={() => setSheet(null)} />}
      </AnimatePresence>

      <AxiomQueryDialog open={axiomOpen} onClose={() => setAxiomOpen(false)} />
    </>
  );
};

export default SpeedDial;
