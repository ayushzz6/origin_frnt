'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial } from './TutorialProvider';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const TutorialOverlay: React.FC = () => {
  const { isActive, currentStep, steps, nextStep, prevStep, skipTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[currentStep];

  useEffect(() => {
    if (!isActive) return;

    const updatePosition = () => {
      if (step.targetId === 'tutorial-welcome') {
        setTargetRect(null);
        return;
      }

      const element = document.getElementById(step.targetId);
      
      // Auto-open mentor if we are on the mentor detail step
      if (step.targetId === 'tutorial-mentor' && !element) {
        document.getElementById('tutorial-mentor-trigger')?.click();
        // Wait a bit for the animation to start and element to appear
        setTimeout(updatePosition, 300);
        return;
      }

      if (element) {
        setTargetRect(element.getBoundingClientRect());
        // Scroll element into view smoothly if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isActive, step, currentStep]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* Dimmed Background with SVG Mask (Spotlight) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <motion.rect
                initial={false}
                animate={{
                  x: targetRect.x - 8,
                  y: targetRect.y - 8,
                  width: targetRect.width + 16,
                  height: targetRect.height + 16,
                  rx: 16
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Tooltip Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            y: 0,
            transition: { type: 'spring', stiffness: 500, damping: 35 }
          }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="pointer-events-none fixed inset-0 z-[10000] flex items-start justify-start p-4"
        >
          <div 
            className="pointer-events-auto"
            style={calculateTooltipPosition(targetRect, step.placement || 'bottom')}
          >
            <div className="w-[calc(100vw-32px)] sm:w-[380px] max-h-[80vh] overflow-y-auto custom-scrollbar premium-card bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-blue-200/50 dark:border-white/10 p-4 sm:p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 relative">
            {/* Ambient Background Glow in Tooltip */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
            
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-[#1e293b] dark:text-white">
                  {step.title}
                </h3>
              </div>
              <button 
                onClick={skipTutorial}
                className="group flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all duration-300"
                title="Skip Tutorial"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Skip</span>
                <X className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium mb-8">
              {step.description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-slate-200 dark:bg-white/10'}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="p-3 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all hover:scale-110 active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <Button 
                  onClick={nextStep}
                  className="relative overflow-hidden bg-primary hover:opacity-90 text-white rounded-full px-6 h-10 text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 group border-none"
                >
                  <span className="relative z-10 flex items-center">
                    {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                    <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                  {/* Subtle shimmer effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      </AnimatePresence>
    </div>
  );
};

function calculateTooltipPosition(rect: DOMRect | null, placement: string) {
  if (!rect) {
    return { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const gap = 20;
  const margin = 20;
  const tooltipWidth = 380;
  const tooltipEstimatedHeight = 250;

  // Initial calculations
  let top = rect.top + rect.height + gap;
  let left = rect.left + rect.width / 2;
  let transformX = '-50%';
  let transformY = '0%';

  const currentPlacement = placement;

  if (currentPlacement === 'top') {
    top = rect.top - gap;
    transformY = '-100%';
  } else if (currentPlacement === 'left') {
    left = rect.left - gap;
    top = rect.top + rect.height / 2;
    transformX = '-100%';
    transformY = '-50%';
  } else if (currentPlacement === 'right') {
    left = rect.left + rect.width + gap;
    top = rect.top + rect.height / 2;
    transformX = '0%';
    transformY = '-50%';
  }

  // SMART FLIP: If bottom placement goes off screen, flip to top
  if (currentPlacement === 'bottom' && top + tooltipEstimatedHeight > window.innerHeight - margin) {
    top = rect.top - gap;
    transformY = '-100%';
  }
  // SMART FLIP: If top placement goes off screen top, flip to bottom
  if (currentPlacement === 'top' && top - tooltipEstimatedHeight < margin) {
    top = rect.top + rect.height + gap;
    transformY = '0%';
  }

  // FINAL CLAMPING to ensure viewport visibility
  // Horizontal clamping
  const minLeft = margin;
  const maxLeft = window.innerWidth - margin;
  
  // Adjust transform if we hit horizontal edges
  const estimatedLeft = left + (transformX === '-50%' ? -tooltipWidth / 2 : transformX === '-100%' ? -tooltipWidth : 0);
  const estimatedRight = estimatedLeft + tooltipWidth;

  if (estimatedLeft < minLeft) {
    left = minLeft;
    transformX = '0%';
  } else if (estimatedRight > maxLeft) {
    left = maxLeft;
    transformX = '-100%';
  }

  // Vertical clamping
  const minTop = margin;
  const maxTop = window.innerHeight - margin;

  const estimatedTop = top + (transformY === '-50%' ? -tooltipEstimatedHeight / 2 : transformY === '-100%' ? -tooltipEstimatedHeight : 0);
  const estimatedBottom = estimatedTop + tooltipEstimatedHeight;

  if (estimatedTop < minTop) {
    top = minTop;
    transformY = '0%';
  } else if (estimatedBottom > maxTop) {
    top = maxTop;
    transformY = '-100%';
  }

  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    transform: `translate(${transformX}, ${transformY})`,
    maxWidth: 'calc(100vw - 40px)'
  };
}
