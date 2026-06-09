'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeft, PanelRight, X, GripVertical } from 'lucide-react';
import OriginAiMentor from '@/components/origin-ai/OriginAiMentor';
import { cn } from '@/lib/utils';
import { useWindowSize } from '@/hooks/use-window-size';

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  width: number;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent) => void;
  side: 'left' | 'right';
  onSideToggle: () => void;
  autoAskSelectionNonce: number;
}

export default function AiSidebar({
  isOpen,
  onClose,
  width,
  isResizing,
  onResizeStart,
  side,
  onSideToggle,
  autoAskSelectionNonce,
}: AiSidebarProps) {
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 768;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: isMobile ? windowWidth : width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={cn(
            "relative z-[60] flex h-dvh flex-col border-border/40 bg-card/50 backdrop-blur-xl transition-colors",
            side === 'left' ? "border-r" : "border-l",
            "fixed md:relative", // Ensure it's fixed on mobile and relative on desktop
            isMobile ? "w-full" : ""
          )}
          style={{ width: isMobile ? '100vw' : `${width}px` }}
        >
          {/* Resize Handle - Hidden on Mobile */}
          <div
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            className={cn(
              "hidden md:block absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-[70]",
              side === 'left' ? "-right-0.5" : "-left-0.5"
            )}
          >
             <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100">
                <GripVertical className="h-4 w-4 text-slate-500" />
             </div>
          </div>

          {/* Bot Content */}
          <div className="flex-1 overflow-hidden flex flex-col h-full">
            <OriginAiMentor
              compact
              isSidebar
              side={side}
              onSideToggle={onSideToggle}
              onClose={onClose}
              autoAskSelectionNonce={autoAskSelectionNonce}
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
