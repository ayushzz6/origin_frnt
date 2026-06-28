'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import TestInterface from '@/sections/TestInterface';
import { submitRoomTestAction } from '@/server/actions/study-room-actions';
import { apiCall } from '@/lib/api';
import { isStudyRoomUnavailableError } from '@/lib/study-rooms/errors';
import type { Test, TestResult } from '@/types';
import type { StudyRoomSummary } from '@/context/StudyRoomContext';

function Countdown({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);
  if (now === 0) return null;
  const remaining = Math.max(0, Math.ceil((new Date(startedAt).getTime() - now) / 1000));
  if (remaining <= 0) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center neu-surface text-foreground">
      <div className="text-center">
        <p className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-primary">Starting In</p>
        <div className="text-8xl font-black tabular-nums text-foreground">{remaining}</div>
      </div>
    </div>
  );
}

export default function RoomTestClient({
  roomId,
  room,
  initialTest,
}: {
  roomId: string;
  room: StudyRoomSummary;
  initialTest: Test;
}) {
  const router = useRouter();
  const timerSource = {
    startedAt: room.started_at ?? new Date().toISOString(),
    durationSeconds: room.duration_seconds ?? initialTest.duration * 60,
    skewMs: 0,
  };

  // Teacher Live Rooms: stamp `entered_test_at` and keep `last_seen_at` fresh so
  // the teacher's live student list shows this student as "giving the test".
  useEffect(() => {
    let cancelled = false;
    const ping = (): void => {
      void apiCall(`/study-rooms/${roomId}`, { method: 'POST', body: JSON.stringify({ on_test: true }) }).catch(() => undefined);
    };
    ping();
    const interval = window.setInterval(() => {
      if (!cancelled) ping();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [roomId]);

  useEffect(() => {
    let isDisposed = false;
    let didRedirect = false;

    const redirectUnavailable = (): void => {
      if (!didRedirect) {
        didRedirect = true;
        toast.info('Room is no longer available.');
      }
      router.push('/study-rooms');
    };

    const verifyRoomAvailable = async (): Promise<void> => {
      try {
        const payload = await apiCall(`/study-rooms/${roomId}`);
        if (isDisposed) return;
        if (payload.room?.status === 'closed') {
          redirectUnavailable();
        }
      } catch (error) {
        if (isStudyRoomUnavailableError(error)) {
          redirectUnavailable();
        }
      }
    };

    const interval = window.setInterval(() => {
      void verifyRoomAvailable();
    }, 5000);

    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, [roomId, router]);

  const handleComplete = (result: TestResult): void => {
    sessionStorage.setItem(`origin_room_test_result_${roomId}`, JSON.stringify(result));
    sessionStorage.setItem(`origin_test_result_${initialTest.id}`, JSON.stringify(result));
    if (result.id) {
      sessionStorage.setItem(`origin_test_result_id_${result.id}`, JSON.stringify(result));
    }
    window.location.assign(`/study-rooms/${roomId}/leaderboard`);
  };

  return (
    <>
      <Countdown startedAt={timerSource.startedAt} />
      <TestInterface
        test={initialTest}
        timerSource={timerSource}
        submitHandler={(payload) => submitRoomTestAction(roomId, payload)}
        onComplete={handleComplete}
        onExit={() => router.push(`/study-rooms/${roomId}/lobby`)}
      />
    </>
  );
}
