import React, { useLayoutEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import Lenis from 'lenis';

export interface ScrollStackItemProps {
  itemClassName?: string;
  children: ReactNode;
}

export const ScrollStackItem: React.FC<ScrollStackItemProps> = ({ children, itemClassName = '' }) => (
  <div
    className={`scroll-stack-card relative w-full h-[80vh] my-12 p-3 sm:p-4 rounded-[24px] sm:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)] box-border origin-top will-change-transform flex flex-col gap-2 sm:gap-3 items-center border border-border/50 dark:border-white/10 ${itemClassName}`.trim()}
    style={{
      backfaceVisibility: 'hidden',
      transformStyle: 'preserve-3d'
    }}
  >
    {children}
  </div>
);

interface ScrollStackProps {
  className?: string;
  children: ReactNode;
  itemDistance?: number;
  itemScale?: number;
  itemStackDistance?: number;
  stackPosition?: string;
  scaleEndPosition?: string;
  baseScale?: number;
  scaleDuration?: number;
  rotationAmount?: number;
  blurAmount?: number;
  useWindowScroll?: boolean;
  onStackComplete?: () => void;
}

const ScrollStack: React.FC<ScrollStackProps> = ({
  children,
  className = '',
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = '20%',
  scaleEndPosition = '10%',
  baseScale = 0.85,
  scaleDuration = 0.5,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = false,
  onStackComplete
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stackCompletedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const cardsRef = useRef<HTMLElement[]>([]);
  const lastTransformsRef = useRef(new Map<number, any>());
  const isUpdatingRef = useRef(false);
  const cardOffsetsRef = useRef<number[]>([]);
  const endElementTopRef = useRef<number>(0);

  const calculateProgress = useCallback((scrollTop: number, start: number, end: number) => {
    if (scrollTop < start) return 0;
    if (scrollTop > end) return 1;
    return (scrollTop - start) / (end - start);
  }, []);

  const parsePercentage = useCallback((value: string | number, containerHeight: number) => {
    if (typeof value === 'string' && value.includes('%')) {
      return (parseFloat(value) / 100) * containerHeight;
    }
    return parseFloat(value as string);
  }, []);

  const getScrollData = useCallback(() => {
    if (useWindowScroll) {
      const mainScroller = document.querySelector('main');
      if (mainScroller) {
        return {
          scrollTop: mainScroller.scrollTop,
          containerHeight: mainScroller.clientHeight,
          scrollContainer: mainScroller
        };
      }
      return {
        scrollTop: window.scrollY,
        containerHeight: window.innerHeight,
        scrollContainer: document.documentElement
      };
    } else {
      const scroller = scrollerRef.current;
      return {
        scrollTop: scroller ? scroller.scrollTop : 0,
        containerHeight: scroller ? scroller.clientHeight : 0,
        scrollContainer: scroller
      };
    }
  }, [useWindowScroll]);

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current) return;

    isUpdatingRef.current = true;

    const { scrollTop, containerHeight } = getScrollData();
    const stackPositionPx = parsePercentage(stackPosition, containerHeight);
    const scaleEndPositionPx = parsePercentage(scaleEndPosition, containerHeight);

    const endElementTop = endElementTopRef.current;

    cardsRef.current.forEach((card, i) => {
      if (!card) return;

      const cardTop = cardOffsetsRef.current[i] ?? 0;
      const triggerStart = cardTop - stackPositionPx - itemStackDistance * i;
      const triggerEnd = cardTop - scaleEndPositionPx;
      const pinStart = cardTop - stackPositionPx - itemStackDistance * i;
      const pinEnd = endElementTop - containerHeight / 2;

      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd);
      const targetScale = baseScale + i * itemScale;
      const scale = 1 - scaleProgress * (1 - targetScale);
      const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0;

      let blur = 0;

      // Always compute top card index for depth-based effects
      let topCardIndex = 0;
      for (let j = 0; j < cardsRef.current.length; j++) {
        const jCardTop = cardOffsetsRef.current[j] ?? 0;
        const jTriggerStart = jCardTop - stackPositionPx - itemStackDistance * j;
        if (scrollTop >= jTriggerStart) {
          topCardIndex = j;
        }
      }

      const depthInStack = topCardIndex - i;

      // Fade out cards deeper than 3 in the stack
      let opacity = 1;
      if (depthInStack >= 4) {
        opacity = 0;
      } else if (depthInStack === 3) {
        opacity = 0.15;
      } else if (depthInStack === 2) {
        opacity = 0.5;
      } else if (depthInStack === 1) {
        opacity = 0.8;
      }

      if (blurAmount && i < topCardIndex) {
        blur = Math.max(0, depthInStack * blurAmount);
      }

      const newTransform = {
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
        opacity: Math.round(opacity * 100) / 100
      };

      const lastTransform = lastTransformsRef.current.get(i);
      const hasChanged =
        !lastTransform ||
        Math.abs(lastTransform.scale - newTransform.scale) > 0.001 ||
        Math.abs(lastTransform.rotation - newTransform.rotation) > 0.1 ||
        Math.abs(lastTransform.blur - newTransform.blur) > 0.1 ||
        Math.abs(lastTransform.opacity - newTransform.opacity) > 0.01;

      if (hasChanged) {
        const transform = `translate3d(0, 0, 0) scale(${newTransform.scale}) rotate(${newTransform.rotation}deg)`;
        const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : '';

        card.style.transform = transform;
        card.style.filter = filter;
        card.style.opacity = String(newTransform.opacity);
        card.style.transition = 'opacity 0.35s ease-out';
        // Hide from layout when fully transparent
        card.style.pointerEvents = newTransform.opacity === 0 ? 'none' : '';
        card.style.visibility = newTransform.opacity === 0 ? 'hidden' : 'visible';

        lastTransformsRef.current.set(i, newTransform);
      }

      if (i === cardsRef.current.length - 1) {
        const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true;
          onStackComplete?.();
        } else if (!isInView && stackCompletedRef.current) {
          stackCompletedRef.current = false;
        }
      }
    });

    isUpdatingRef.current = false;
  }, [
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    rotationAmount,
    blurAmount,
    onStackComplete,
    calculateProgress,
    parsePercentage,
    getScrollData
  ]);

  const handleScroll = useCallback(() => {
    updateCardTransforms();
  }, [updateCardTransforms]);

  const setupLenis = useCallback(() => {
    if (useWindowScroll) {
      const mainScroller = document.querySelector('main');
      if (typeof window !== 'undefined' && (window as any).lenis && (window as any).lenis.options && (window as any).lenis.options.wrapper === mainScroller) {
        const lenis = (window as any).lenis;
        lenis.on('scroll', handleScroll);
        lenisRef.current = lenis;
        return lenis;
      }

      const lenis = new Lenis({
        wrapper: mainScroller || undefined,
        content: mainScroller ? (mainScroller.firstElementChild as HTMLElement) : undefined,
        duration: 1.2,
        easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        infinite: false,
        wheelMultiplier: 1,
        lerp: 0.1,
        syncTouch: false,
        syncTouchLerp: 0.075
      });

      lenis.on('scroll', handleScroll);

      const raf = (time: number) => {
        lenis.raf(time);
        animationFrameRef.current = requestAnimationFrame(raf);
      };
      animationFrameRef.current = requestAnimationFrame(raf);

      lenisRef.current = lenis;
      return lenis;
    } else {
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const lenis = new Lenis({
        wrapper: scroller,
        content: scroller.querySelector('.scroll-stack-inner') as HTMLElement,
        duration: 1.2,
        easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        infinite: false,
        gestureOrientation: 'vertical',
        wheelMultiplier: 1,
        lerp: 0.1,
        syncTouch: false,
        syncTouchLerp: 0.075
      });

      lenis.on('scroll', handleScroll);

      const raf = (time: number) => {
        lenis.raf(time);
        animationFrameRef.current = requestAnimationFrame(raf);
      };
      animationFrameRef.current = requestAnimationFrame(raf);

      lenisRef.current = lenis;
      return lenis;
    }
  }, [handleScroll, useWindowScroll]);

  useLayoutEffect(() => {
    if (!useWindowScroll && !scrollerRef.current) return;

    const cards = Array.from(
      useWindowScroll
        ? document.querySelectorAll('.scroll-stack-card')
        : (scrollerRef.current?.querySelectorAll('.scroll-stack-card') ?? [])
    ) as HTMLElement[];
    cardsRef.current = cards;
    const transformsCache = lastTransformsRef.current;

    // Apply native stickiness and compute static document offsets
    const offsets: number[] = [];
    cards.forEach((card, i) => {
      card.style.position = 'sticky';
      card.style.top = `calc(${stackPosition} + ${i * itemStackDistance}px)`;
      if (i < cards.length - 1) {
        card.style.marginBottom = `${itemDistance}px`;
      }
      card.style.willChange = 'transform, filter';
      card.style.transformOrigin = 'top center';
      card.style.backfaceVisibility = 'hidden';
      card.style.transform = 'translateZ(0)';
      card.style.webkitTransform = 'translateZ(0)';
      card.style.perspective = '1000px';
      card.style.webkitPerspective = '1000px';

      // Compute document-level offset top once
      let top = 0;
      if (useWindowScroll) {
        const mainScroller = document.querySelector('main');
        if (mainScroller) {
          const rect = card.getBoundingClientRect();
          const scrollerRect = mainScroller.getBoundingClientRect();
          top = rect.top - scrollerRect.top + mainScroller.scrollTop;
        } else {
          const rect = card.getBoundingClientRect();
          top = rect.top + window.scrollY;
        }
      } else {
        top = card.offsetTop;
      }
      offsets.push(top);
    });
    cardOffsetsRef.current = offsets;

    // Compute end element offset once
    const endElement = useWindowScroll
      ? (document.querySelector('.scroll-stack-end') as HTMLElement | null)
      : (scrollerRef.current?.querySelector('.scroll-stack-end') as HTMLElement | null);
    if (endElement) {
      if (useWindowScroll) {
        const mainScroller = document.querySelector('main');
        if (mainScroller) {
          const rect = endElement.getBoundingClientRect();
          const scrollerRect = mainScroller.getBoundingClientRect();
          endElementTopRef.current = rect.top - scrollerRect.top + mainScroller.scrollTop;
        } else {
          const rect = endElement.getBoundingClientRect();
          endElementTopRef.current = rect.top + window.scrollY;
        }
      } else {
        endElementTopRef.current = endElement.offsetTop;
      }
    }

    setupLenis();

    updateCardTransforms();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (lenisRef.current) {
        if (typeof window !== 'undefined' && lenisRef.current === (window as any).lenis) {
          lenisRef.current.off('scroll', handleScroll);
        } else {
          lenisRef.current.destroy();
        }
      }
      stackCompletedRef.current = false;
      cardsRef.current = [];
      transformsCache.clear();
      isUpdatingRef.current = false;
    };
  }, [
    itemDistance,
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    scaleDuration,
    rotationAmount,
    blurAmount,
    useWindowScroll,
    onStackComplete,
    setupLenis,
    updateCardTransforms
  ]);

  return (
    <div
      className={`relative w-full overflow-x-visible ${useWindowScroll ? 'overflow-y-visible h-auto' : 'h-full overflow-y-auto'} ${className}`.trim()}
      ref={scrollerRef}
      style={useWindowScroll ? {
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        willChange: 'scroll-position'
      } : {
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        scrollBehavior: 'smooth',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        willChange: 'scroll-position'
      }}
    >
      <div className={`scroll-stack-inner px-2 sm:px-6 md:px-12 ${useWindowScroll ? 'pt-4 pb-[90vh]' : 'pt-4 pb-[35rem] min-h-screen'}`}>
        {children}
        {/* Spacer so the last pin can release cleanly */}
        <div className="scroll-stack-end w-full h-px" />
      </div>
    </div>
  );
};

export default ScrollStack;
