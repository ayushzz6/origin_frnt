'use client';

/**
 * useMentorMascotState — derives the mascot's MascotState from OriginAiMentor's existing
 * signals, so Ori reacts to real user actions:
 *
 *   user typing / voice listening → curious
 *   request in flight / voice thinking / booting → thinking
 *   voice speaking → answering
 *   a fresh assistant reply landed → success (brief pulse), then back to idle
 *   voice error → error
 *   otherwise → idle
 */
import { useEffect, useRef, useState } from 'react';

import type { MascotState } from './mascot-state';
import type { OriginAiVoiceStatus } from '@/types';

export interface MentorMascotSignals {
  isLoading: boolean;
  isSending: boolean;
  voiceStatus: OriginAiVoiceStatus;
  message: string;
  /** Number of messages in the session (used to detect a fresh reply). */
  messageCount: number;
}

/** How long the success pulse lasts after a reply lands (ms). */
const SUCCESS_MS = 1700;

export function useMentorMascotState({
  isLoading,
  isSending,
  voiceStatus,
  message,
  messageCount,
}: MentorMascotSignals): MascotState {
  const [isSuccess, setIsSuccess] = useState(false);
  const prevCount = useRef(messageCount);

  // Detect a fresh assistant reply (message count grew while not sending) → success pulse.
  useEffect(() => {
    const grew = messageCount > prevCount.current;
    prevCount.current = messageCount;
    if (!grew || isSending) return;
    let alive = true;
    queueMicrotask(() => {
      if (alive) setIsSuccess(true);
    });
    const t = setTimeout(() => {
      if (alive) setIsSuccess(false);
    }, SUCCESS_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [messageCount, isSending]);

  if (voiceStatus === 'error') return 'error';
  if (isSending || isLoading || voiceStatus === 'thinking') return 'thinking';
  if (isSuccess) return 'success';
  if (voiceStatus === 'speaking') return 'answering';
  if (voiceStatus === 'listening') return 'curious';
  if (message.trim().length > 0) return 'curious';
  return 'idle';
}
