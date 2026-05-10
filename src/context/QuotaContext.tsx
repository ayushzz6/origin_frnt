'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';

interface QuotaState {
  voiceSecondsUsed: number;
  textTokensUsed: number;
  lastResetDate: string;
}

interface QuotaContextType {
  voiceSecondsUsed: number;
  textTokensUsed: number;
  voiceLimitSeconds: number;
  textLimitTokens: number;
  isVoiceQuotaReached: boolean;
  isTextQuotaReached: boolean;
  addTextUsage: (tokens: number) => void;
  startVoiceTracking: () => void;
  stopVoiceTracking: () => void;
  getRemainingVoiceTime: () => string;
  getRemainingTokens: () => string;
  voiceProgress: number;
  textProgress: number;
}

const VOICE_LIMIT_SECONDS = 10 * 60; // 10 minutes
const TEXT_LIMIT_TOKENS = 200000; // 200k tokens
// const QUOTA_STORAGE_KEY = 'origin_ai_quota'; // Replaced by user-specific key
const EMPTY_QUOTA_STATE: QuotaState = {
  voiceSecondsUsed: 0,
  textTokensUsed: 0,
  lastResetDate: '',
};

const QuotaContext = createContext<QuotaContextType | undefined>(undefined);

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

function isToday(value?: string | Date | null): boolean {
  if (!value) {
    return true;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return date.toISOString().split('T')[0] === todayString();
}

function quotaFromUser(user: ReturnType<typeof useAuth>['user']): QuotaState | null {
  if (!user) {
    return null;
  }

  if (!isToday(user.usageResetAt)) {
    return {
      voiceSecondsUsed: 0,
      textTokensUsed: 0,
      lastResetDate: todayString(),
    };
  }

  return {
    voiceSecondsUsed: Math.round((user.voiceMinutesUsedToday ?? 0) * 60),
    textTokensUsed: user.tokensUsedToday ?? 0,
    lastResetDate: todayString(),
  };
}

export function QuotaProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QuotaState>(EMPTY_QUOTA_STATE);

  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedThresholds = useRef<Set<string>>(new Set());
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const storageKey = user?.id ? `origin_ai_quota_${user.id}` : 'origin_ai_quota_guest';

  // Load from localStorage when user or storageKey changes, then anchor to server usage.
  useEffect(() => {
    // Reset thresholds when user changes
    notifiedThresholds.current.clear();

    const serverState = quotaFromUser(user);
    if (serverState) {
      setState(serverState);
      localStorage.setItem(storageKey, JSON.stringify(serverState));
      return;
    }

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as QuotaState;
        const today = todayString();
        
        if (parsed.lastResetDate !== today) {
          // Reset for new day
          const newState = {
            voiceSecondsUsed: 0,
            textTokensUsed: 0,
            lastResetDate: today,
          };
          setState(newState);
          localStorage.setItem(storageKey, JSON.stringify(newState));
        } else {
          setState(parsed);
        }
      } catch (e) {
        console.error('Failed to parse quota state', e);
      }
    } else {
      // No saved state for this user, start fresh
      const freshState = {
        voiceSecondsUsed: 0,
        textTokensUsed: 0,
        lastResetDate: todayString(),
      };
      setState(freshState);
      localStorage.setItem(storageKey, JSON.stringify(freshState));
    }
  }, [storageKey, user]);

  // Save to localStorage when state or storageKey changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const checkNotifications = useCallback((type: 'voice' | 'text', used: number, limit: number) => {
    const progress = (used / limit) * 100;
    const thresholds = [50, 75, 90, 100];
    
    thresholds.forEach(threshold => {
      const key = `${type}-${threshold}`;
      if (progress >= threshold && !notifiedThresholds.current.has(key)) {
        if (threshold === 100) {
          toast.error(`Daily ${type} quota reached!`, {
            description: `You have used 100% of your daily ${type} limit.`,
          });
          addNotification({
            title: `Daily ${type} Quota Exhausted`,
            message: `You have reached 100% of your daily ${type} limit for Origin AI.`,
            type: 'warning'
          });
        } else {
          toast.warning(`Daily ${type} quota alert`, {
            description: `You have used ${threshold}% of your daily ${type} limit.`,
          });
        }
        notifiedThresholds.current.add(key);
      }
    });

    // Reset thresholds if usage is below them (shouldn't happen unless reset)
    if (progress === 0) {
      notifiedThresholds.current.clear();
    }
  }, [addNotification]);

  const addTextUsage = useCallback((tokens: number) => {
    setState(prev => {
      const nextUsed = prev.textTokensUsed + tokens;
      checkNotifications('text', nextUsed, TEXT_LIMIT_TOKENS);
      return { ...prev, textTokensUsed: nextUsed };
    });
  }, [checkNotifications]);

  const startVoiceTracking = useCallback(() => {
    if (voiceTimerRef.current) return;
    
    voiceTimerRef.current = setInterval(() => {
      setState(prev => {
        const nextUsed = prev.voiceSecondsUsed + 1;
        checkNotifications('voice', nextUsed, VOICE_LIMIT_SECONDS);
        
        if (nextUsed >= VOICE_LIMIT_SECONDS) {
          if (voiceTimerRef.current) {
            clearInterval(voiceTimerRef.current);
            voiceTimerRef.current = null;
          }
        }
        
        return { ...prev, voiceSecondsUsed: nextUsed };
      });
    }, 1000);
  }, [checkNotifications]);

  const stopVoiceTracking = useCallback(() => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }, []);

  const getRemainingVoiceTime = useCallback(() => {
    const remaining = Math.max(0, VOICE_LIMIT_SECONDS - state.voiceSecondsUsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}m ${secs}s remaining`;
  }, [state.voiceSecondsUsed]);

  const getRemainingTokens = useCallback(() => {
    const remaining = Math.max(0, TEXT_LIMIT_TOKENS - state.textTokensUsed);
    return `${remaining.toLocaleString()} tokens remaining`;
  }, [state.textTokensUsed]);

  const voiceProgress = (state.voiceSecondsUsed / VOICE_LIMIT_SECONDS) * 100;
  const textProgress = (state.textTokensUsed / TEXT_LIMIT_TOKENS) * 100;

  const value = {
    voiceSecondsUsed: state.voiceSecondsUsed,
    textTokensUsed: state.textTokensUsed,
    voiceLimitSeconds: VOICE_LIMIT_SECONDS,
    textLimitTokens: TEXT_LIMIT_TOKENS,
    isVoiceQuotaReached: state.voiceSecondsUsed >= VOICE_LIMIT_SECONDS,
    isTextQuotaReached: state.textTokensUsed >= TEXT_LIMIT_TOKENS,
    addTextUsage,
    startVoiceTracking,
    stopVoiceTracking,
    getRemainingVoiceTime,
    getRemainingTokens,
    voiceProgress,
    textProgress,
  };

  return <QuotaContext.Provider value={value}>{children}</QuotaContext.Provider>;
}

export function useQuota() {
  const context = useContext(QuotaContext);
  if (context === undefined) {
    throw new Error('useQuota must be used within a QuotaProvider');
  }
  return context;
}
