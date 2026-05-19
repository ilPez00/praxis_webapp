import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';

interface Brief {
  date: string;
  priority: { name: string; domain: string; progress: number };
  action: string;
  why: string;
  secondary?: string;
  patternAlert?: string;
  dreamProposal?: string;
  meta: { consistency: number; daysSinceCheckin: number; daysToDeadline: number };
}

const AxiomBriefStrip: React.FC = () => {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/axiom/morning-brief')
      .then(r => setBrief(r.data?.brief ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-4 mt-3 h-14 bg-surface border border-border rounded-lg animate-pulse" />
    );
  }

  if (!brief) return null;

  const daysLeft = brief.meta.daysToDeadline < 900
    ? `${Math.round(brief.meta.daysToDeadline)}d left`
    : null;
  const stale = brief.meta.daysSinceCheckin > 3;

  return (
    <motion.div
      className="mx-4 mt-3 bg-surface border border-border rounded-lg overflow-hidden cursor-pointer"
      onClick={() => setExpanded(e => !e)}
      layout
    >
      {/* Collapsed header */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="mt-0.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-amber mt-1.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-2xs text-amber font-bold tracking-widest">AXIOM</span>
            {brief.patternAlert && (
              <span className="font-mono text-2xs text-red bg-red/10 border border-red/20 rounded px-1 py-0.5 tracking-wide">
                ALERT
              </span>
            )}
            {daysLeft && (
              <span className={`font-mono text-2xs font-bold tracking-wide ${brief.meta.daysToDeadline < 7 ? 'text-red' : 'text-sub'}`}>
                {daysLeft}
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-fg leading-snug line-clamp-1">
            {brief.action}
          </p>
        </div>
        <span className="font-mono text-2xs text-dim mt-1 shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border"
          >
            <div className="px-3 py-2.5 space-y-2">
              <div>
                <span className="font-mono text-2xs text-dim tracking-widest">GOAL</span>
                <p className="font-mono text-xs text-fg mt-0.5">{brief.priority.name}</p>
              </div>
              <div>
                <span className="font-mono text-2xs text-dim tracking-widest">ACTION</span>
                <p className="font-mono text-sm text-amber font-bold mt-0.5 leading-snug">{brief.action}</p>
              </div>
              <div>
                <span className="font-mono text-2xs text-dim tracking-widest">WHY</span>
                <p className="font-mono text-xs text-sub mt-0.5 leading-snug">{brief.why}</p>
              </div>
              {brief.secondary && brief.secondary !== 'None' && (
                <div>
                  <span className="font-mono text-2xs text-dim tracking-widest">SECONDARY</span>
                  <p className="font-mono text-xs text-fg mt-0.5 leading-snug">{brief.secondary}</p>
                </div>
              )}
              {brief.patternAlert && (
                <div className="bg-red/5 border border-red/20 rounded px-2 py-1.5">
                  <p className="font-mono text-xs text-red leading-snug">{brief.patternAlert}</p>
                </div>
              )}
              {brief.dreamProposal && (
                <div className="bg-amber/5 border border-amber/20 rounded px-2 py-1.5">
                  <span className="font-mono text-2xs text-amber font-bold tracking-widest block mb-0.5">DREAM</span>
                  <p className="font-mono text-xs text-sub leading-snug whitespace-pre-line">{brief.dreamProposal}</p>
                </div>
              )}
              <div className="flex gap-4 pt-1">
                <span className="font-mono text-2xs text-dim">
                  {Math.round(brief.meta.consistency * 7 * 10) / 10}/wk
                </span>
                {stale && (
                  <span className="font-mono text-2xs text-red">
                    {Math.round(brief.meta.daysSinceCheckin)}d no check-in
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AxiomBriefStrip;
