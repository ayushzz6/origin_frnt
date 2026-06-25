'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';

import { useHighlightedSelection, snapshotHighlightedText } from '@/features/origin-ai/highlight-capture';
import OriMascotStatic from '@/features/mascot/OriMascotStatic';

const OriMascot = dynamic(() => import('@/features/mascot/OriMascot'), { ssr: false });

interface FloatingChatProps {
  onOpen: (options?: { autoAskSelection?: boolean }) => void;
  autoAskSelectionNonce: number;
  hideMainButton?: boolean;
}

export default function FloatingChat({ onOpen, hideMainButton }: FloatingChatProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightedSelection = useHighlightedSelection();
  const [hovered, setHovered] = useState(false);

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
        <div ref={containerRef} className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 lg:bottom-6 lg:right-6 z-50 flex flex-col items-end">
          <motion.button
            type="button"
            data-origin-ai-root="true"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onHoverStart={() => setHovered(true)}
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
              <div className="relative z-10 h-16 w-16 drop-shadow-2xl sm:h-24 sm:w-24 lg:h-[118px] lg:w-[118px]">
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
