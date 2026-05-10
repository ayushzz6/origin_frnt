'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PAGES_STEPS, TutorialStep } from './steps';

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  steps: TutorialStep[];
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  startTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const getPageFromPath = (path: string) => {
  if (path === '/dashboard') return 'dashboard';
  if (path === '/ogcode') return 'ogcode-list';
  if (path.startsWith('/ogcode')) return 'ogcode-workspace';
  if (path.includes('doubt-solver')) return 'doubt-solver';
  if (path.includes('test-list')) return 'test-list';
  if (path.includes('dpp')) return 'dpp';
  if (path.includes('tasks-goals')) return 'tasks-goals';
  return null;
};

const getStorageKey = (userId: string | number, page: string) => `origin_tutorial_${userId}_${page}_completed`;

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [activePage, setActivePage] = useState<string | null>(null);

  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    const page = getPageFromPath(pathname);
    if (!page || !user) {
      setIsActive(false);
      return;
    }

    setActivePage(page);
    setCurrentStep(0);

    // Persistence Check
    const isCompleted = localStorage.getItem(getStorageKey(user.id, page));
    
    // Set to false to enable persistence, true for testing
    const forceShow = false; 

    if (!isCompleted || forceShow) {
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setIsActive(false);
    }
  }, [pathname, user]);

  const steps = activePage ? PAGES_STEPS[activePage] || [] : [];

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsActive(false);
      if (activePage && user) {
        localStorage.setItem(getStorageKey(user.id, activePage), 'true');
      }
    }
  }, [currentStep, steps, activePage, user]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    if (activePage && user) {
      localStorage.setItem(getStorageKey(user.id, activePage), 'true');
    }
  }, [activePage, user]);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return (
    <TutorialContext.Provider value={{
      isActive,
      currentStep,
      steps,
      nextStep,
      prevStep,
      skipTutorial,
      startTutorial
    }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};
