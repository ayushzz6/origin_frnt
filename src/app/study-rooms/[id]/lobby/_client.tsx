'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, WifiOff, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { InviteCodeCard } from '@/components/study-rooms/InviteCodeCard';
import { LobbyChat } from '@/components/study-rooms/LobbyChat';
import { ParticipantList } from '@/components/study-rooms/ParticipantList';
import { TestConfigDrawer } from '@/components/study-rooms/TestConfigDrawer';
import { DeleteRoomButton } from '@/components/study-rooms/DeleteRoomButton';
import { StudyRoomProvider, useStudyRoom, type StudyRoomStatePayload } from '@/context/StudyRoomContext';

function LobbyContent({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';

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

  const statusLabel = roomStatus.replace('_', ' ');

  return (
    <>
      <style>{`
        .scanline-bg {
          background-color: #050810;
          background-image:
            linear-gradient(rgba(5,8,16,0.9),rgba(5,8,16,0.9)),
            url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==");
          background-size: cover, 4px 4px;
        }
        .cockpit-frame {
          border: 2px solid #1a2333;
          box-shadow: inset 0 0 50px rgba(0,0,0,0.8), 0 0 30px rgba(43,177,255,0.08);
          position: relative;
        }
        .cockpit-frame::before {
          content: '';
          position: absolute;
          top: -2px; left: 10%; right: 10%; height: 2px;
          background: linear-gradient(90deg, transparent, #2bb1ff, transparent);
          opacity: 0.5;
          pointer-events: none;
        }
        @keyframes lobby-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .lobby-live-dot { animation: lobby-pulse 1.6s ease-in-out infinite; }
        @keyframes lobby-float-a { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes lobby-float-b { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .lobby-float-a { animation: lobby-float-a 4.5s ease-in-out infinite; }
        .lobby-float-b { animation: lobby-float-b 5.5s ease-in-out infinite 0.6s; }
      `}</style>

      <main className={cn(
        'min-h-screen w-full px-3 sm:px-5 py-4 sm:py-6 text-foreground',
        isDark ? 'scanline-bg' : 'bg-background',
      )}>
        <div className={cn(
          'relative mx-auto w-full max-w-7xl rounded-[20px] overflow-hidden',
          isDark ? 'cockpit-frame bg-[#0a0d14]/80 backdrop-blur-3xl' : 'neu-surface',
        )}>
          {/* Decorative ori mascots (atmospheric) */}
          <img
            src="/ori2d/ori-cheerful.png"
            alt=""
            draggable={false}
            className={cn(
              'hidden md:block pointer-events-none select-none absolute top-3 right-6 w-20 lg:w-24 z-0 lobby-float-a',
              isDark ? 'opacity-25 blur-[0.5px]' : 'opacity-40',
            )}
          />
          <img
            src="/ori2d/ori-reading.png"
            alt=""
            draggable={false}
            className={cn(
              'hidden xl:block pointer-events-none select-none absolute bottom-4 left-4 w-20 z-0 lobby-float-b',
              isDark ? 'opacity-15 blur-[1px]' : 'opacity-25',
            )}
          />

          <div className="relative z-10 flex flex-col gap-6 p-4 sm:p-6 lg:p-8">

            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <button
                  type="button"
                  onClick={() => router.push('/study-rooms')}
                  className={cn(
                    'mb-3 flex items-center gap-1.5 text-sm font-bold transition-colors',
                    isDark ? 'text-slate-500 hover:text-[#2bb1ff]' : 'text-muted-foreground hover:text-primary',
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Rooms
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className={cn(
                    'text-2xl sm:text-3xl font-black tracking-tight',
                    isDark ? 'text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]' : 'text-foreground',
                  )}>
                    {room.room.name}
                  </h1>
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border',
                    isDark ? 'bg-[#2bb1ff]/10 text-[#2bb1ff] border-[#2bb1ff]/30' : 'bg-primary/10 text-primary border-transparent',
                  )}>
                    {statusLabel}
                  </span>
                  <span className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border',
                    room.isConnected
                      ? isDark
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-emerald-500/10 text-emerald-600 border-transparent'
                      : isDark
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-amber-500/10 text-amber-600 border-transparent',
                  )}>
                    {room.isConnected
                      ? <Radio className="h-3 w-3 lobby-live-dot" />
                      : <WifiOff className="h-3 w-3" />}
                    {room.isConnected ? 'Live' : 'Reconnecting'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {room.is_admin && (
                  <>
                    <TestConfigDrawer disabled={room.room.status !== 'lobby'} onConfigure={room.configureTest} />
                    <DeleteRoomButton roomName={room.room.name} onDelete={room.deleteRoom} />
                    <button
                      type="button"
                      disabled={!room.room.custom_test_id || room.room.status !== 'lobby'}
                      onClick={start}
                      className={cn(
                        'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                        isDark
                          ? 'bg-gradient-to-r from-[#2bb1ff] to-[#006495] text-white border border-white/15 shadow-[0_0_22px_rgba(43,177,255,0.32)] hover:scale-[1.02] hover:shadow-[0_0_34px_rgba(43,177,255,0.5)] disabled:hover:scale-100'
                          : 'bg-primary text-primary-foreground shadow-[3px_3px_8px_hsl(var(--neu-shadow))] hover:-translate-y-0.5 disabled:hover:translate-y-0',
                      )}
                    >
                      <Play className="h-4 w-4" />
                      Start Test
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={room.leaveRoom}
                  className={cn(
                    'rounded-xl px-4 py-2.5 text-sm font-bold transition-all border',
                    isDark
                      ? 'bg-[#111520] border-[#1a2333] text-slate-300 hover:text-white hover:border-[#2bb1ff]/40'
                      : 'neu-raised border-transparent hover:-translate-y-0.5',
                  )}
                >
                  Leave
                </button>
              </div>
            </header>

            {/* ── Body grid ──────────────────────────────────────────── */}
            <div className="grid gap-5 lg:grid-cols-[320px_1fr] lg:items-stretch">
              <div className="flex flex-col gap-5">
                <InviteCodeCard inviteCode={room.current_code} isAdmin={room.is_admin} onRegenerate={room.regenerateCode} />

                {/* Compact Test Status (with ori mascot) */}
                {(() => {
                  const ready = Boolean(room.room.custom_test_id);
                  return (
                    <section className={cn(
                      'rounded-2xl p-4 border flex items-center gap-3.5',
                      isDark
                        ? ready
                          ? 'bg-emerald-500/5 border-emerald-500/25'
                          : 'bg-[#0d111a]/80 border-[#1a2333] backdrop-blur-md'
                        : 'neu-raised border-transparent',
                    )}>
                      <img
                        src={ready ? '/ori2d/ori-exited.png' : '/ori2d/ori-determined.png'}
                        alt=""
                        draggable={false}
                        className="w-14 h-14 object-contain flex-shrink-0 select-none lobby-float-a"
                      />
                      <div className="min-w-0">
                        <h2 className={cn(
                          'text-[9px] font-black uppercase tracking-[0.22em]',
                          isDark ? 'text-slate-500' : 'text-muted-foreground',
                        )}>
                          Test Status
                        </h2>
                        <p className={cn(
                          'text-[13px] font-bold leading-snug mt-1',
                          ready
                            ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                            : isDark ? 'text-slate-300' : 'text-foreground',
                        )}>
                          {ready
                            ? 'Test ready — the admin can start anytime.'
                            : 'Waiting for the admin to configure a test.'}
                        </p>
                      </div>
                    </section>
                  );
                })()}

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
            </div>
          </div>
        </div>
      </main>
    </>
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
