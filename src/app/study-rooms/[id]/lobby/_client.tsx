'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InviteCodeCard } from '@/components/study-rooms/InviteCodeCard';
import { LobbyChat } from '@/components/study-rooms/LobbyChat';
import { ParticipantList } from '@/components/study-rooms/ParticipantList';
import { TestConfigDrawer } from '@/components/study-rooms/TestConfigDrawer';
import { DeleteRoomButton } from '@/components/study-rooms/DeleteRoomButton';
import { StudyRoomProvider, useStudyRoom, type StudyRoomStatePayload } from '@/context/StudyRoomContext';

function LobbyContent({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const room = useStudyRoom();
  const refreshRoom = room.refresh;
  const roomId = room.room.id;
  const roomStatus = room.room.status;

  useEffect(() => {
    if (roomStatus === 'in_test') {
      router.push(`/study-rooms/${roomId}/test`);
    }
    if (roomStatus === 'finished') {
      router.push(`/study-rooms/${roomId}/leaderboard`);
    }
    if (roomStatus === 'closed') {
      toast.info('Room closed.');
      router.push('/study-rooms');
    }
  }, [roomId, roomStatus, router]);

  useEffect(() => {
    if (roomStatus !== 'lobby') return;
    const timer = window.setInterval(() => {
      void refreshRoom().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refreshRoom, roomStatus]);

  const start = async (): Promise<void> => {
    try {
      await room.startTest();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start test.');
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Button variant="ghost" size="sm" className="mb-3" onClick={() => router.push('/study-rooms')}>
              <ArrowLeft className="h-4 w-4" />
              Rooms
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight">{room.room.name}</h1>
              <Badge className="rounded-md">{room.room.status.replace('_', ' ')}</Badge>
              <Badge variant="secondary" className="rounded-md">
                {room.isConnected ? <Wifi className="mr-1 h-3 w-3" /> : <WifiOff className="mr-1 h-3 w-3" />}
                {room.isConnected ? 'Live' : 'Reconnecting'}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {room.is_admin && (
              <>
                <TestConfigDrawer disabled={room.room.status !== 'lobby'} onConfigure={room.configureTest} />
                <DeleteRoomButton roomName={room.room.name} onDelete={room.deleteRoom} />
                <Button disabled={!room.room.custom_test_id || room.room.status !== 'lobby'} onClick={start}>
                  <Play className="h-4 w-4" />
                  Start Test
                </Button>
              </>
            )}
            <Button variant="outline" onClick={room.leaveRoom}>Leave</Button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr_360px]">
          <div className="space-y-5">
            <InviteCodeCard inviteCode={room.current_code} isAdmin={room.is_admin} onRegenerate={room.regenerateCode} />
            <ParticipantList
              participants={room.participants}
              currentUserId={currentUserId}
              isAdmin={room.is_admin}
              onKick={room.kickParticipant}
              onTransferAdmin={room.transferAdmin}
            />
          </div>

          <LobbyChat
            messages={room.messages}
            locked={room.room.status !== 'lobby'}
            currentUserId={currentUserId}
            onSend={room.sendChat}
            pendingMessages={room.pending}
            typingUsers={room.typingUsers}
            onTyping={room.sendTyping}
          />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-500">Test Status</h2>
            {room.room.custom_test_id ? (
              <div className="rounded-lg bg-green-50 p-4 text-sm font-bold text-green-800 dark:bg-green-950/30 dark:text-green-300">
                Test ready. The admin can start when participants are prepared.
              </div>
            ) : (
              <div className="rounded-lg bg-slate-100 p-4 text-sm font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Waiting for the admin to configure a custom test.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function LobbyClient({
  roomId,
  currentUserId,
  initialState,
}: {
  roomId: string;
  currentUserId: string;
  initialState: StudyRoomStatePayload;
}) {
  return (
    <StudyRoomProvider roomId={roomId} currentUserId={currentUserId} initialState={initialState}>
      <LobbyContent currentUserId={currentUserId} />
    </StudyRoomProvider>
  );
}
