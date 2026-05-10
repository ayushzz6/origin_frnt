'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWindowSize } from '@/hooks/use-window-size';

interface LayoutContextType {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  isAiOpen: boolean;
  setIsAiOpen: (isOpen: boolean) => void;
  availableWidth: number;
  windowWidth: number;
  askSelectionNonce: number;
  triggerAskSelection: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [askSelectionNonce, setAskSelectionNonce] = useState(0);
  const { width: windowWidth } = useWindowSize();
  
  const triggerAskSelection = () => {
    setAskSelectionNonce(prev => prev + 1);
  };

  // Use a stable default width for SSR to prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSR, we assume a standard desktop width or just 0
  // On the client, we start with 0 (matching server) until we mount
  const effectiveWindowWidth = isMounted ? windowWidth : 0;
  const availableWidth = isAiOpen ? effectiveWindowWidth - sidebarWidth : effectiveWindowWidth;

  return (
    <LayoutContext.Provider value={{ 
      sidebarWidth, 
      setSidebarWidth, 
      isAiOpen, 
      setIsAiOpen, 
      availableWidth, 
      windowWidth: effectiveWindowWidth,
      askSelectionNonce,
      triggerAskSelection
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
