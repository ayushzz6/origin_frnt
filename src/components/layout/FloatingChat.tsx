'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';

import { useHighlightedSelection, snapshotHighlightedText } from '@/features/origin-ai/highlight-capture';
import OriMascotStatic from '@/features/mascot/OriMascotStatic';

const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });

const GREET_MESSAGES = [
  (name: string) => `Hey ${name}! 👋 I'm Ori — ask me anything`,
  (name: string) => `Hi ${name}! Stuck? I've got you `,
  (name: string) => `${name}, let's crack this together `,
  (name: string) => `Need a hint, ${name}? I'm right here 💡`,
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

          {/* Speech bubble */}
          <AnimatePresence>
            {bubbleVisible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 8 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="relative mr-2 max-w-[180px] rounded-2xl rounded-br-sm border border-border/40 bg-background/95 px-3 py-2 shadow-xl backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => setBubbleVisible(false)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  aria-label="Dismiss"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
                <p className="text-[11px] font-medium leading-snug text-foreground">{bubbleText}</p>
                {/* Tail pointing down-right toward mascot */}
                <div className="absolute -bottom-[7px] right-3 h-3 w-3 rotate-45 border-b border-r border-border/40 bg-background/95" />
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
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
              </div>
              <div className="relative z-10 block h-36 w-36 drop-shadow-2xl lg:h-[267px] lg:w-[282px]">
                <OriMascot state={hovered ? 'curious' : 'idle'} title="Origin AI" preload={false} />
              </div>
              <div className="absolute right-2 top-2 z-20 h-3 w-3 rounded-full border-2 border-white bg-primary shadow-md dark:border-slate-900 sm:right-2.5 sm:top-2.5 sm:h-3.5 sm:w-3.5 lg:right-4 lg:top-4 lg:h-4 lg:w-4" />
            </div>
          </motion.button>
        </div>
      )}
    </>
  );
}
