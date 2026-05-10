'use client';

import { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import { useHighlightedSelection, snapshotHighlightedText } from '@/features/origin-ai/highlight-capture';

interface FloatingChatProps {
  onOpen: (options?: { autoAskSelection?: boolean }) => void;
  autoAskSelectionNonce: number;
  hideMainButton?: boolean;
}

export default function FloatingChat({ onOpen, hideMainButton }: FloatingChatProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightedSelection = useHighlightedSelection();

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
              <img src="/Dipraj-ChatBot.png" alt="Origin AI" className="h-full w-full object-contain" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-900 dark:text-primary/80">
              Ask Origin AI
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {!hideMainButton && (
        <div ref={containerRef} className="fixed bottom-4 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onOpen()}
            id="tutorial-mentor-trigger"
            className="relative outline-none"
            aria-label="Open Origin AI"
          >
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-0 transition-transform duration-500 group-hover:scale-150" />
              <div className="absolute inset-0 z-0 flex items-center justify-center text-blue-100">
                <Sparkles className="h-7 w-7" />
              </div>
              <img
                src="/Dipraj-ChatBot.png"
                alt="Origin AI"
                className="relative z-10 h-24 w-24 object-contain drop-shadow-2xl transition-all duration-300 group-hover:brightness-110 sm:h-28 sm:w-28"
                onError={(event) => {
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute right-4 top-4 z-20 h-4 w-4 rounded-full border-2 border-white bg-primary shadow-md dark:border-slate-900" />
            </div>
          </motion.button>
        </div>
      )}
    </>
  );
}
