'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
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

type State = StudyRoomStatePayload & {
  isConnected: boolean;
  isLoading: boolean;
};

type Action =
  | { type: 'seed'; payload: StudyRoomStatePayload }
  | { type: 'connected'; connected: boolean }
  | { type: 'event'; event: RoomEvent; currentUserId: string };

type StudyRoomContextValue = State & {
  refresh: () => Promise<StudyRoomStatePayload>;
  sendChat: (content: string) => Promise<void>;
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
    return { ...action.payload, isConnected: state.isConnected, isLoading: false };
  }
  if (action.type === 'connected') {
    return { ...state, isConnected: action.connected };
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
}: {
  children: React.ReactNode;
  roomId: string;
  currentUserId: string;
  initialState: StudyRoomStatePayload;
}) {
  const router = useRouter();
  const unavailableRedirectedRef = useRef(false);
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    isConnected: false,
    isLoading: false,
  });

  const redirectToRooms = useCallback((message: string): void => {
    if (!unavailableRedirectedRef.current) {
      unavailableRedirectedRef.current = true;
      toast.info(message);
    }
    router.push('/study-rooms');
  }, [router]);

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
          router.push('/study-rooms');
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
  }, [currentUserId, redirectToRooms, refresh, roomId, router]);

  const value = useMemo<StudyRoomContextValue>(() => ({
    ...state,
    refresh,
    sendChat: async (content: string): Promise<void> => {
      await runRoomRequest(() => apiCall(`/study-rooms/${roomId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }));
    },
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
      router.push('/study-rooms');
    },
    deleteRoom: async (): Promise<void> => {
      await runRoomRequest(() => apiCall(`/study-rooms/${roomId}`, { method: 'DELETE' }));
      router.push('/study-rooms');
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
  }), [currentUserId, refresh, roomId, router, runRoomRequest, state]);

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>;
}

export function useStudyRoom() {
  const context = useContext(StudyRoomContext);
  if (!context) {
    throw new Error('useStudyRoom must be used within StudyRoomProvider.');
  }
  return context;
}
