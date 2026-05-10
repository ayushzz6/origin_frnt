import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  side: 'left' | 'right';
}

export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
  side,
}: UseResizableOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);

  // Clamp width when window resizes or maxWidth changes
  useEffect(() => {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const effectiveMaxWidth = Math.min(maxWidth, windowWidth * 0.8);
    
    if (width > effectiveMaxWidth) {
      setWidth(Math.max(minWidth, effectiveMaxWidth));
    }
  }, [maxWidth, minWidth, width]);

  // Sync ref with state
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return;

      let clientX: number;
      if (e instanceof MouseEvent) {
        clientX = e.clientX;
      } else {
        clientX = e.touches[0].clientX;
      }

      let newWidth: number;
      if (side === 'right') {
        newWidth = window.innerWidth - clientX;
      } else {
        newWidth = clientX;
      }

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    },
    [isResizing, minWidth, maxWidth, side]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('touchmove', resize);
      window.addEventListener('touchend', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('touchend', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return { width, isResizing, startResizing };
}
