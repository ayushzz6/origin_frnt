'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { apiCall } from '@/lib/api';
import { parseRoomEvent, type ParticipantSummary, type RoomEvent, type RoomMessage } from '@/lib/study-rooms/events';
import { isStudyRoomUnavailableError } from '@/lib/study-rooms/errors';

export type StudyRoomSummary = {
  id: string;
  name: string;
  admin_user_id: string;
  created_by: string;
  status: 'lobby' | 'in_test' | 'finished' | 'closed';
  custom_test_id: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  max_participants: number;
  created_at: string;
  updated_at: string;
};

export type StudyRoomStatePayload = {
  room: StudyRoomSummary;
  participants: ParticipantSummary[];
  messages: RoomMessage[];
  current_code: { code: string; ttl_seconds: number; expires_at: string } | null;
  is_admin: boolean;
};

/** A chat message shown instantly before the server round-trip confirms it. */
export type PendingMessage = {
  tempId: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
};

/** A participant the reducer believes is currently typing. */
type TypingEntry = { display_name: string; at: number };

/** How long a typing ping is considered "fresh" before it auto-expires (ms). */
const TYPING_TTL_MS = 5000;
/** Idle delay after which we auto-send a "stopped typing" ping (ms). */
const TYPING_STOP_DELAY_MS = 3500;

type State = StudyRoomStatePayload & {
  isConnected: boolean;
  isLoading: boolean;
  typing: Record<string, TypingEntry>;
  pending: PendingMessage[];
};

type Action =
  | { type: 'seed'; payload: StudyRoomStatePayload }
  | { type: 'connected'; connected: boolean }
  | { type: 'event'; event: RoomEvent; currentUserId: string }
  | { type: 'pending_add'; message: PendingMessage }
  | { type: 'pending_remove'; tempId: string };

type StudyRoomContextValue = State & {
  /** Other participants currently typing (excludes the current user, auto-expiring). */
  typingUsers: { user_id: string; display_name: string }[];
  refresh: () => Promise<StudyRoomStatePayload>;
  sendChat: (content: string) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  regenerateCode: () => Promise<void>;
  configureTest: (payload: { subject?: string; difficulty?: string; chapter?: string; question_count?: number }) => Promise<void>;
  startTest: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  deleteRoom: () => Promise<void>;
  kickParticipant: (userId: string) => Promise<void>;
  transferAdmin: (userId: string) => Promise<void>;
};

const StudyRoomContext = createContext<StudyRoomContextValue | null>(null);

type StartRoomResponse = Omit<Extract<RoomEvent, { type: 'test_started' }>, 'type'>;

function reducer(state: State, action: Action): State {
  if (action.type === 'seed') {
    // Merge messages by id (union) rather than replace, so a periodic state
    // refresh never momentarily drops a message that arrived over SSE but is
    // not yet in the snapshot. Room messages are append-only, so union is safe.
    const byId = new Map<number, RoomMessage>();
    for (const message of action.payload.messages) byId.set(message.id, message);
    for (const message of state.messages) if (!byId.has(message.id)) byId.set(message.id, message);
    const messages = Array.from(byId.values()).sort((a, b) => a.id - b.id).slice(-100);
    return { ...state, ...action.payload, messages, isConnected: state.isConnected, isLoading: false };
  }
  if (action.type === 'connected') {
    return { ...state, isConnected: action.connected };
  }
  if (action.type === 'pending_add') {
    return { ...state, pending: [...state.pending, action.message] };
  }
  if (action.type === 'pending_remove') {
    return { ...state, pending: state.pending.filter((message) => message.tempId !== action.tempId) };
  }

  const event = action.event;
  if (event.type === 'presence') {
    const isAdmin = event.participants.some((participant) => participant.user_id === action.currentUserId && participant.role === 'admin');
    return { ...state, participants: event.participants, is_admin: isAdmin };
  }
  if (event.type === 'chat') {
    if (state.messages.some((message) => message.id === event.message.id)) return state;
    return { ...state, messages: [...state.messages, event.message].slice(-100) };
  }
  if (event.type === 'typing') {
    const next = { ...state.typing };
    if (event.is_typing) {
      next[event.user_id] = { display_name: event.display_name, at: Date.now() };
    } else {
      delete next[event.user_id];
    }
    return { ...state, typing: next };
  }
  if (event.type === 'admin_changed') {
    return {
      ...state,
      room: { ...state.room, admin_user_id: event.new_admin_user_id },
      is_admin: event.new_admin_user_id === action.currentUserId,
      participants: state.participants.map((participant) => ({
        ...participant,
        role: participant.user_id === event.new_admin_user_id ? 'admin' : 'participant',
      })),
    };
  }
  if (event.type === 'test_configured') {
    return { ...state, room: { ...state.room, custom_test_id: event.custom_test_id } };
  }
  if (event.type === 'test_started') {
    return {
      ...state,
      room: {
        ...state.room,
        status: 'in_test',
        custom_test_id: event.custom_test_id,
        started_at: event.started_at,
        duration_seconds: event.duration_seconds,
      },
    };
  }
  if (event.type === 'participant_finished') {
    return {
      ...state,
      participants: state.participants.map((participant) =>
        participant.user_id === event.user_id ? { ...participant, finished_at: participant.finished_at ?? new Date().toISOString(), rank: event.rank ?? participant.rank } : participant,
      ),
    };
  }
  if (event.type === 'test_ended') {
    return { ...state, room: { ...state.room, status: 'finished', ended_at: event.ended_at } };
  }
  if (event.type === 'room_closed') {
    return { ...state, room: { ...state.room, status: 'closed' } };
  }
  return state;
}

export function StudyRoomProvider({
  children,
  roomId,
  currentUserId,
  initialState,
  listHref = '/study-rooms',
  onTest = false,
}: {
  children: React.ReactNode;
  roomId: string;
  currentUserId: string;
  initialState: StudyRoomStatePayload;
  /** Where to redirect on kick / room close / leave. Teacher surface overrides this. */
  listHref?: string;
  /** When true, heartbeats stamp `entered_test_at` (this client is on the test surface). */
  onTest?: boolean;
}) {
  const router = useRouter();
  const unavailableRedirectedRef = useRef(false);
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    isConnected: false,
    isLoading: false,
    typing: {},
    pending: [],
  });

  const redirectToRooms = useCallback((message: string): void => {
    if (!unavailableRedirectedRef.current) {
      unavailableRedirectedRef.current = true;
      toast.info(message);
    }
    router.push(listHref);
  }, [router, listHref]);

  const handleUnavailableRoom = useCallback((error: unknown): boolean => {
    if (!isStudyRoomUnavailableError(error)) {
      return false;
    }
    redirectToRooms('Room is no longer available.');
    return true;
  }, [redirectToRooms]);

  const runRoomRequest = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      handleUnavailableRoom(error);
      throw error;
    }
  }, [handleUnavailableRoom]);

  const refresh = useCallback(async (): Promise<StudyRoomStatePayload> => {
    const payload = await runRoomRequest<StudyRoomStatePayload>(() => apiCall(`/study-rooms/${roomId}`));
    dispatch({ type: 'seed', payload });
    return payload;
  }, [roomId, runRoomRequest]);

  useEffect(() => {
    const source = new EventSource(`/api/study-rooms/${roomId}/stream`);
    source.onopen = () => {
      dispatch({ type: 'connected', connected: true });
      void refresh().catch(() => undefined);
    };
    source.onerror = () => {
      dispatch({ type: 'connected', connected: false });
      void refresh().catch(() => undefined);
    };
    source.onmessage = (message) => {
      const parsed = parseRoomEvent(JSON.parse(message.data));
      if (parsed) dispatch({ type: 'event', event: parsed, currentUserId });
    };

    const eventTypes: RoomEvent['type'][] = [
      'presence',
      'chat',
      'typing',
      'admin_changed',
      'kicked',
      'test_configured',
      'test_started',
      'participant_finished',
      'test_ended',
      'room_closed',
    ];

    for (const eventType of eventTypes) {
      source.addEventListener(eventType, (message) => {
        const parsed = parseRoomEvent(JSON.parse((message as MessageEvent).data));
        if (!parsed) return;
        if (parsed.type === 'kicked' && parsed.user_id === currentUserId) {
          toast.error('You were removed from the study room.');
          router.push(listHref);
          return;
        }
        if (parsed.type === 'room_closed') {
          redirectToRooms('Room closed.');
          return;
        }
        dispatch({ type: 'event', event: parsed, currentUserId });
      });
    }

    return () => source.close();
  }, [currentUserId, listHref, redirectToRooms, refresh, roomId, router]);

  // ---- Presence heartbeat --------------------------------------------------
  // Keeps `last_seen_at` fresh (online/offline) and, on the test surface,
  // stamps `entered_test_at`. Best-effort; failures are ignored.
  useEffect(() => {
    let cancelled = false;
    const ping = (): void => {
      void apiCall(`/study-rooms/${roomId}`, { method: 'POST', body: JSON.stringify({ on_test: onTest }) }).catch(() => undefined);
    };
    ping();
    const interval = setInterval(() => {
      if (!cancelled) ping();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, onTest]);

  // ---- Typing indicator (WhatsApp-style) -----------------------------------
  // Fire-and-forget; typing is best-effort and never blocks the UI.
  const emitTyping = useCallback(async (isTyping: boolean): Promise<void> => {
    try {
      await apiCall(`/study-rooms/${roomId}/chat`, { method: 'PUT', body: JSON.stringify({ is_typing: isTyping }) });
    } catch {
      // Ignore — a dropped typing ping is harmless.
    }
  }, [roomId]);

  const typingStateRef = useRef<{ active: boolean; stopTimer: ReturnType<typeof setTimeout> | null }>({ active: false, stopTimer: null });

  const sendTyping = useCallback((isTyping: boolean): void => {
    const st = typingStateRef.current;
    if (isTyping) {
      if (st.stopTimer) clearTimeout(st.stopTimer);
      st.stopTimer = setTimeout(() => {
        st.active = false;
        void emitTyping(false);
      }, TYPING_STOP_DELAY_MS);
      if (!st.active) {
        st.active = true;
        void emitTyping(true);
      }
    } else {
      if (st.stopTimer) {
        clearTimeout(st.stopTimer);
        st.stopTimer = null;
      }
      if (st.active) {
        st.active = false;
        void emitTyping(false);
      }
    }
  }, [emitTyping]);

  // Recompute the visible typers periodically so stale pings auto-expire.
  // `typingNow` is a state timestamp (kept pure for render) advanced by the
  // interval only while someone is actually typing.
  const [typingNow, setTypingNow] = useState(() => Date.now());
  const hasTypers = Object.keys(state.typing).length > 0;
  useEffect(() => {
    if (!hasTypers) return;
    const interval = setInterval(() => setTypingNow(Date.now()), 1500);
    return () => clearInterval(interval);
  }, [hasTypers]);

  const typingUsers = useMemo(() => {
    const cutoff = typingNow - TYPING_TTL_MS;
    return Object.entries(state.typing)
      .filter(([userId, entry]) => userId !== currentUserId && entry.at >= cutoff)
      .map(([userId, entry]) => ({ user_id: userId, display_name: entry.display_name }));
  }, [state.typing, currentUserId, typingNow]);

  const value = useMemo<StudyRoomContextValue>(() => ({
    ...state,
    typingUsers,
    refresh,
    sendChat: async (content: string): Promise<void> => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Optimistic echo — the message appears instantly, before the round-trip.
      dispatch({
        type: 'pending_add',
        message: { tempId, user_id: currentUserId, display_name: '', content: trimmed, created_at: new Date().toISOString() },
      });
      sendTyping(false);
      try {
        const response = await runRoomRequest<{ message: RoomMessage }>(() => apiCall(`/study-rooms/${roomId}/chat`, {
          method: 'POST',
          body: JSON.stringify({ content: trimmed }),
        }));
        if (response?.message) {
          dispatch({ type: 'event', event: { type: 'chat', message: response.message }, currentUserId });
        }
        dispatch({ type: 'pending_remove', tempId });
      } catch (error) {
        dispatch({ type: 'pending_remove', tempId });
        throw error;
      }
    },
    sendTyping,
    regenerateCode: async (): Promise<void> => {
      const payload = await runRoomRequest(() => apiCall(`/study-rooms/${roomId}/code`, { method: 'POST' }));
      dispatch({ type: 'seed', payload: { ...state, current_code: payload.invite_code } });
    },
    configureTest: async (payload): Promise<void> => {
      await runRoomRequest(() => apiCall(`/study-rooms/${roomId}/configure-test`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }));
      await refresh();
    },
    startTest: async (): Promise<void> => {
      try {
        const payload = await runRoomRequest<StartRoomResponse>(() => apiCall(`/study-rooms/${roomId}/start`, { method: 'POST' }));
        dispatch({ type: 'event', event: { type: 'test_started', ...payload }, currentUserId });
        router.push(`/study-rooms/${roomId}/test`);
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes('left the lobby')) {
          const latest = await refresh();
          if (latest.room.status === 'in_test') {
            router.push(`/study-rooms/${roomId}/test`);
            return;
          }
          if (latest.room.status === 'finished') {
            router.push(`/study-rooms/${roomId}/leaderboard`);
            return;
          }
        }
        throw error;
      }
    },
    leaveRoom: async (): Promise<void> => {
      await runRoomRequest(() => apiCall(`/study-rooms/${roomId}/leave`, { method: 'POST' }));
      router.push(listHref);
    },
    deleteRoom: async (): Promise<void> => {
      await runRoomRequest(() => apiCall(`/study-rooms/${roomId}`, { method: 'DELETE' }));
      router.push(listHref);
    },
    kickParticipant: async (userId: string): Promise<void> => {
      await runRoomRequest(() => apiCall(`/study-rooms/${roomId}/kick`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      }));
    },
    transferAdmin: async (userId: string): Promise<void> => {
      await runRoomRequest(() => apiCall(`/study-rooms/${roomId}/transfer-admin`, {
        method: 'POST',
        body: JSON.stringify({ new_admin_user_id: userId }),
      }));
    },
  }), [currentUserId, listHref, refresh, roomId, router, runRoomRequest, sendTyping, state, typingUsers]);

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>;
}

export function useStudyRoom() {
  const context = useContext(StudyRoomContext);
  if (!context) {
    throw new Error('useStudyRoom must be used within StudyRoomProvider.');
  }
  return context;
}
