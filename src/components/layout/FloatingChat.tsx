'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';

import { useHighlightedSelection, snapshotHighlightedText } from '@/features/origin-ai/highlight-capture';
import OriMascotStatic from '@/features/mascot/OriMascotStatic';

const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });

// Kept short so each greeting fits on a single line inside the cloud.
const GREET_MESSAGES = [
  (name: string) => `Hey ${name}! Ask me anything 👋`,
  (name: string) => `Stuck, ${name}? I've got you 💡`,
  (name: string) => `Let's crack this, ${name}! ✨`,
  (name: string) => `Need a hint, ${name}? 💡`,
];

interface FloatingChatProps {
  onOpen: (options?: { autoAskSelection?: boolean }) => void;
  autoAskSelectionNonce: number;
  hideMainButton?: boolean;
  userName?: string;
}

export default function FloatingChat({ onOpen, hideMainButton, userName }: FloatingChatProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightedSelection = useHighlightedSelection();
  const [hovered, setHovered] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * GREET_MESSAGES.length));
  const firstName = userName?.split(' ')[0] ?? 'there';
  const bubbleText = GREET_MESSAGES[msgIndex](firstName);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = (pickNew = false) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (pickNew) setMsgIndex(Math.floor(Math.random() * GREET_MESSAGES.length));
    setBubbleVisible(true);
    dismissTimerRef.current = setTimeout(() => setBubbleVisible(false), 4000);
  };

  // Auto-show once after 2 s on mount
  useEffect(() => {
    if (hideMainButton) return;
    const t = setTimeout(() => showBubble(), 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideMainButton]);

  // Random re-show every 25–45 s while mascot is visible
  useEffect(() => {
    if (hideMainButton) return;
    const schedule = () => {
      const delay = 25000 + Math.floor(Math.random() * 20000);
      return setTimeout(() => {
        showBubble(true);
        timerRef.current = schedule();
      }, delay);
    };
    const timerRef = { current: schedule() };
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideMainButton]);

  const selectionActionStyle = useMemo(() => {
    const rect = highlightedSelection.rect;
    if (!rect || typeof window === 'undefined') {
      return null;
    }

    const viewportWidth = window.innerWidth;
    const top = Math.max(16, rect.top - 18);
    const left = Math.max(72, Math.min(viewportWidth - 72, rect.left + rect.width / 2));

    return {
      top,
      left,
    };
  }, [highlightedSelection.rect]);

  const shouldShowSelectionAction =
    Boolean(highlightedSelection.text?.trim()) &&
    Boolean(selectionActionStyle);

  return (
    <>
      <AnimatePresence>
        {shouldShowSelectionAction && selectionActionStyle ? (
          <motion.button
            type="button"
            key="origin-ai-selection-action"
            data-origin-ai-root="true"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.16 }}
            onMouseDown={() => {
              // Snapshot BEFORE the browser clears the selection (mousedown is the first event)
              snapshotHighlightedText();
            }}
            onClick={() => onOpen({ autoAskSelection: true })}
            className="fixed z-[70] flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-background/90 px-2 py-1.5 text-foreground shadow-xl backdrop-blur-md transition-colors"
            style={{
              top: `${selectionActionStyle.top}px`,
              left: `${selectionActionStyle.left}px`,
              transform: 'translate(-50%, -100%)',
            }}
            aria-label="Ask Origin AI about the selected text"
          >
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-primary/10 p-0.5">
              <OriMascotStatic className="h-full w-full" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-900 dark:text-primary/80">
              Ask Origin AI
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {!hideMainButton && (
        <div ref={containerRef} className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end gap-2">

          {/* Glossy 3D cloud thought-bubble — the greeting sits inside the cloud on one line */}
          <AnimatePresence>
            {bubbleVisible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 12 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                className="relative mr-10 text-white dark:text-slate-100"
              >
                {/* Cloud shape, stretched to hug the one-line message behind it */}
                <div className="relative px-7 py-4">
                  <svg
                    viewBox="0 0 300 130"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    aria-hidden
                  >
                    <defs>
                      <filter id="ori-cloud-shadow" x="-20%" y="-20%" width="140%" height="150%">
                        <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="rgba(15,23,42,0.18)" />
                      </filter>
                    </defs>
                    <g filter="url(#ori-cloud-shadow)" fill="currentColor">
                      <ellipse cx="150" cy="84" rx="138" ry="40" />
                      <circle cx="58" cy="66" r="30" />
                      <circle cx="116" cy="50" r="38" />
                      <circle cx="184" cy="48" r="40" />
                      <circle cx="244" cy="66" r="31" />
                      <circle cx="30" cy="84" r="22" />
                      <circle cx="272" cy="84" r="22" />
                    </g>
                    {/* top gloss highlight for the 3D sheen */}
                    <ellipse cx="135" cy="46" rx="74" ry="15" fill="#ffffff" opacity="0.5" />
                    {/* soft bottom contact shading for depth */}
                    <ellipse cx="150" cy="112" rx="120" ry="12" fill="rgba(15,23,42,0.05)" />
                  </svg>

                  <button
                    type="button"
                    onClick={() => setBubbleVisible(false)}
                    className="absolute right-1 top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-sm hover:bg-red-100 hover:text-red-400 dark:bg-slate-700 dark:text-slate-300"
                    aria-label="Dismiss"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>

                  <p className="relative z-10 whitespace-nowrap text-center text-[12px] font-bold leading-none text-slate-700 dark:text-slate-800">
                    {bubbleText}
                  </p>
                </div>

                {/* Thought-bubble trailing puffs toward the mascot (down-right) */}
                <span className="absolute -bottom-1 right-6 h-3 w-3 rounded-full bg-current shadow-[0_2px_4px_rgba(15,23,42,0.15)]" />
                <span className="absolute -bottom-3 right-3 h-2 w-2 rounded-full bg-current shadow-[0_2px_4px_rgba(15,23,42,0.15)]" />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            data-origin-ai-root="true"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onHoverStart={() => { setHovered(true); showBubble(true); }}
            onHoverEnd={() => setHovered(false)}
            onClick={() => onOpen()}
            id="tutorial-mentor-trigger"
            className="relative outline-none"
            aria-label="Open Origin AI"
          >
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-0 transition-transform duration-500 group-hover:scale-150" />
              <div className="absolute inset-0 z-0 flex items-center justify-center text-blue-100">
                <Sparkles className="h-4 w-4 lg:h-5 lg:w-5" />
              </div>
              <div className="relative z-10 block h-24 w-24 drop-shadow-2xl lg:h-28 lg:w-28">
                <OriMascot state={hovered ? 'curious' : 'idle'} title="Origin AI" preload={false} />
              </div>
              <div className="absolute right-1.5 top-1.5 z-20 h-3 w-3 rounded-full border-2 border-white bg-primary shadow-md dark:border-slate-900 lg:right-2 lg:top-2 lg:h-3.5 lg:w-3.5" />
            </div>
          </motion.button>
        </div>
      )}
    </>
  );
}
