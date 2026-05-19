import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const TOUR_KEY = 'praxis_tour_v2_seen';

interface Slide {
  icon: string;
  title: string;
  body: string;
  sub?: string;
  color: string;
  cta?: { label: string; path: string };
}

const SLIDES: Slide[] = [
  {
    icon: '⚡',
    title: 'Welcome to Praxis',
    body: 'Praxis is a selection engine. Every day it tells you what to focus on — and holds you accountable to it.',
    sub: 'Your goals, your commitments, your people. All in one place.',
    color: '#F59E0B',
  },
  {
    icon: '🎯',
    title: 'TODAY tab',
    body: "Axiom — your AI coach — reads your goals and checks in daily. It tells you exactly what to do and why.",
    sub: 'Tap the amber dot to expand the brief. Check in with one tap.',
    color: '#F59E0B',
    cta: { label: 'See today\'s brief', path: '/dashboard' },
  },
  {
    icon: '📔',
    title: 'DIARY tab',
    body: 'Your journal is your goal tree. Every goal, check-in, and win is a diary entry. Write freely, link to goals, export anytime.',
    sub: 'Axiom can rewrite your diary as a memoir. Try EXPORT → Axiom Narrative.',
    color: '#A78BFA',
    cta: { label: 'Open diary', path: '/diary' },
  },
  {
    icon: '👥',
    title: 'SOCIAL tab',
    body: 'Find people with aligned goals. Follow their progress, message them, form accountability groups.',
    sub: 'Matches are scored by goal overlap. Your feed shows their check-ins, not just posts.',
    color: '#3B82F6',
    cta: { label: 'Find matches', path: '/matches' },
  },
  {
    icon: '⚡',
    title: 'BETS tab',
    body: 'Put Praxis Points behind a goal. Fulfill it → double back. Miss it → forfeit. Or post an Open Challenge and bet against your network.',
    sub: 'Real-money bets (€) available via Stripe. Always refundable if you cancel before start.',
    color: '#22C55E',
    cta: { label: 'Make a commitment', path: '/commitments' },
  },
  {
    icon: '📊',
    title: 'ME tab',
    body: 'Your stats, streaks, achievements, and analytics. Tap your streak to see the full heatmap.',
    sub: 'Settings → connect Google Drive to sync your diary automatically.',
    color: '#EF4444',
    cta: { label: 'See my profile', path: '/profile' },
  },
  {
    icon: '✚',
    title: 'Speed Dial',
    body: 'The + button (bottom right) is your quick-action hub. Log a diary entry, post, create a bet, message someone, or ask Axiom — all in one tap.',
    sub: 'It\'s always there, on every screen.',
    color: '#F59E0B',
  },
  {
    icon: '🏁',
    title: 'You\'re ready.',
    body: 'Set your first goal, make your first check-in, and let Axiom guide the rest.',
    sub: 'You can revisit this tour from Settings → How it works.',
    color: '#F59E0B',
    cta: { label: 'Set first goal', path: '/goal-selection' },
  },
];

const WelcomeTour: React.FC = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
  };

  const go = (delta: number) => {
    setDir(delta);
    const next = slide + delta;
    if (next >= SLIDES.length) { dismiss(); return; }
    if (next < 0) return;
    setSlide(next);
  };

  const goTo = (i: number) => { setDir(i > slide ? 1 : -1); setSlide(i); };

  if (!visible) return null;

  const s = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80">
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={slide}
          custom={dir}
          variants={{
            enter: (d: number) => ({ x: d * 60, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: -d * 60, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="w-full max-w-lg bg-surface border-t border-border rounded-t-3xl p-6 pb-10"
        >
          {/* Progress dots */}
          <div className="flex gap-1.5 justify-center mb-6">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className="h-1 rounded-full transition-all duration-200"
                style={{
                  width: i === slide ? 24 : 6,
                  backgroundColor: i === slide ? s.color : '#333',
                }}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: s.color + '18', border: `1px solid ${s.color}40` }}>
              {s.icon}
            </div>
          </div>

          {/* Content */}
          <h2 className="font-mono text-lg font-black text-fg text-center mb-2" style={{ color: s.color }}>
            {s.title}
          </h2>
          <p className="font-mono text-sm text-fg text-center leading-relaxed mb-2">
            {s.body}
          </p>
          {s.sub && (
            <p className="font-mono text-2xs text-dim text-center leading-relaxed mb-4">
              {s.sub}
            </p>
          )}

          {/* CTA */}
          {s.cta && (
            <button
              onClick={() => { dismiss(); navigate(s.cta!.path); }}
              className="w-full mb-3 py-2.5 border rounded-lg font-mono text-xs font-bold tracking-widest transition-colors"
              style={{ borderColor: s.color + '60', color: s.color }}
            >
              {s.cta.label} →
            </button>
          )}

          {/* Nav */}
          <div className="flex gap-3">
            {slide > 0 && (
              <button onClick={() => go(-1)}
                className="flex-1 py-2.5 border border-border rounded-lg font-mono text-xs text-dim hover:text-fg transition-colors">
                ← BACK
              </button>
            )}
            <button
              onClick={() => go(1)}
              className="flex-1 py-2.5 rounded-lg font-mono text-xs font-black transition-colors"
              style={{ backgroundColor: s.color, color: '#080808' }}
            >
              {isLast ? 'GET STARTED' : 'NEXT →'}
            </button>
          </div>

          <button onClick={dismiss}
            className="w-full text-center font-mono text-2xs text-dim mt-3 hover:text-sub transition-colors">
            skip tour
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export { WelcomeTour, TOUR_KEY };
export default WelcomeTour;
