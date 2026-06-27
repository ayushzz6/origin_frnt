'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, LogIn, Zap, Trophy, UsersRound,
  ChevronRight, HelpCircle, ArrowRight, Users, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

import { apiCall } from '@/lib/api';
import { formatStudyRoomDateTime } from '@/lib/study-rooms/date-format';
import { cn } from '@/lib/utils';
import type { RoomSummary } from '@/server/study-rooms';

const STATUS_CFG: Record<string, { label: string; dot: string; darkText: string; Icon: typeof Zap }> = {
  lobby:    { label: 'Lobby',    dot: 'bg-[#2bb1ff]',   darkText: 'text-[#2bb1ff]',  Icon: UsersRound },
  in_test:  { label: 'Live',     dot: 'bg-amber-400',   darkText: 'text-amber-400',  Icon: Zap },
  finished: { label: 'Finished', dot: 'bg-emerald-400', darkText: 'text-emerald-400',Icon: Trophy },
  closed:   { label: 'Closed',   dot: 'bg-slate-500',   darkText: 'text-slate-500',  Icon: UsersRound },
};

export default function StudyRoomsClient({
  initialRooms,
}: {
  initialRooms: RoomSummary[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    if (!howToOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHowToOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [howToOpen]);

  const [rooms] = useState(initialRooms);
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const joinByCode = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      router.push('/study-rooms/join');
      return;
    }
    setIsJoining(true);
    try {
      const payload = await apiCall('/study-rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      router.push(`/study-rooms/${payload.roomId}/lobby`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not join room.';
      if (/changed/i.test(message)) {
        setRoomCode('');
        toast.error('The room code changed', {
          description: 'Ask your teacher for the new code, then enter it again.',
        });
      } else {
        toast.error(message);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const resumeRoom = (room: RoomSummary) => {
    router.push(
      room.status === 'lobby'   ? `/study-rooms/${room.id}/lobby` :
      room.status === 'in_test' ? `/study-rooms/${room.id}/test`  :
                                  `/study-rooms/${room.id}/leaderboard`
    );
  };

  const createQuickRoom = async () => {
    setIsCreatingQuick(true);
    try {
      const payload = await apiCall('/study-rooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Study Room' }),
      });
      router.push(`/study-rooms/${payload.room.id}/lobby`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create room.');
    } finally {
      setIsCreatingQuick(false);
    }
  };

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
          border-radius: 20px;
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
        .cockpit-frame::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 20%; right: 20%; height: 2px;
          background: linear-gradient(90deg, transparent, #2bb1ff, transparent);
          opacity: 0.25;
          pointer-events: none;
        }
        .platform-glow {
          box-shadow: 0 0 50px rgba(43,177,255,0.55), inset 0 0 24px rgba(43,177,255,0.7);
        }
        @keyframes ring-pulse {
          0%   { transform: translate(-50%,-50%) scale(0.88); opacity: 0.55; }
          100% { transform: translate(-50%,-50%) scale(1.75); opacity: 0; }
        }
        .ped-ring {
          position: absolute; top: 50%; left: 50%;
          width: 100%; height: 100%; border-radius: 50%;
          border: 1px solid rgba(43,177,255,0.45);
          animation: ring-pulse 2.6s ease-out infinite;
          pointer-events: none;
        }
        .ped-ring:nth-child(2) { animation-delay: 0.87s;  border-color: rgba(43,177,255,0.28); }
        .ped-ring:nth-child(3) { animation-delay: 1.74s;  border-color: rgba(0,240,255,0.2); }
        @keyframes float-a { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-18px)} }
        @keyframes float-b { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-12px)} }
        @keyframes float-c { 0%,100%{transform:translateY(-4px)}50%{transform:translateY(-14px)} }
        @keyframes float-d { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-9px)}  }
        .float-a { animation: float-a 4s ease-in-out infinite; }
        .float-b { animation: float-b 5s ease-in-out infinite 0.5s; }
        .float-c { animation: float-c 4.5s ease-in-out infinite 1s; }
        .float-d { animation: float-d 6s ease-in-out infinite 1.5s; }
      `}</style>

      {/* ── Root ──────────────────────────────────────────────────────────── */}
      <div className={cn(
        'fixed left-0 right-0 top-14 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:inset-y-0 md:left-[72px] md:right-0 md:bottom-0 z-40 flex overflow-hidden p-0 sm:p-3',
        isDark ? 'scanline-bg' : 'bg-background',
      )}>
        <div className={cn(
          'flex w-full h-full overflow-hidden',
          isDark
            ? 'cockpit-frame bg-[#0a0d14]/80 backdrop-blur-3xl'
            : 'rounded-2xl neu-surface',
        )}>

          {/* ── Mobile backdrop ──────────────────────────────────────────── */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════════
              LEFT SIDEBAR  (w-64 — narrower for better center ratio)
          ════════════════════════════════════════════════════════════════ */}
          <aside className={cn(
            'w-64 flex-shrink-0 flex flex-col py-6 z-50 overflow-hidden',
            sidebarOpen ? 'fixed inset-y-0 left-0' : 'hidden lg:flex',
            isDark
              ? 'bg-[#0d111a]/90 border-r border-[#1a2333] shadow-[5px_0_20px_rgba(0,0,0,0.4)]'
              : 'border-r border-border/20',
          )}>
            {/* Logo */}
            <div className="px-6 mb-7 flex flex-col items-center">
              <div className={cn(
                'text-xl font-black flex items-center gap-0.5',
                isDark ? 'text-white' : 'text-foreground',
              )}>
                <span>ori</span>
                <span className={cn('text-primary', isDark && 'text-[#2bb1ff] drop-shadow-[0_0_10px_rgba(43,177,255,0.8)]')}>.explains</span>
              </div>
              <div className={cn(
                'text-[9px] tracking-[0.25em] uppercase font-bold mt-1.5 text-center w-full border-b pb-4',
                isDark ? 'text-slate-600 border-[#1a2333]' : 'text-muted-foreground border-border/20',
              )}>LEARN · PLAY · COMPETE</div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto">
              {/* Join Room — primary active */}
              <Link
                href="/study-rooms/join"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-3 relative overflow-hidden transition-all',
                  isDark
                    ? 'bg-gradient-to-r from-[#2bb1ff]/20 to-transparent border border-[#2bb1ff]/40 text-white shadow-[0_0_16px_rgba(43,177,255,0.12)]'
                    : 'bg-primary/10 border border-primary/20 text-primary',
                )}
              >
                {isDark && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#2bb1ff] shadow-[0_0_10px_#2bb1ff]" />}
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                  isDark ? 'bg-[#111520] border border-[#2bb1ff]/50' : 'bg-primary/10',
                )}>
                  <LogIn className={cn('h-3.5 w-3.5', isDark ? 'text-[#2bb1ff]' : 'text-primary')} />
                </div>
                <span className="font-bold text-[13px] tracking-wider uppercase">Join Room</span>
                <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" />
              </Link>

              {/* Create Room */}
              <Link
                href="/study-rooms/create"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all border border-transparent',
                  isDark
                    ? 'text-slate-400 hover:bg-white/5 hover:text-white hover:border-white/10'
                    : 'text-foreground/70 hover:text-foreground hover:bg-primary/5',
                )}
              >
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
                  isDark ? 'border-[#00f0ff]/30 bg-[#00f0ff]/10' : 'border-primary/20 bg-primary/10',
                )}>
                  <Plus className={cn('h-3.5 w-3.5', isDark ? 'text-[#00f0ff]' : 'text-primary')} />
                </span>
                <span className="font-bold text-[13px] tracking-wider uppercase">Create Room</span>
              </Link>

              {/* Quick Room */}
              <button
                type="button"
                onClick={() => { setSidebarOpen(false); void createQuickRoom(); }}
                disabled={isCreatingQuick}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all border border-transparent',
                  isDark
                    ? 'text-slate-400 hover:bg-white/5 hover:text-white hover:border-white/10 disabled:opacity-50'
                    : 'text-foreground/70 hover:text-foreground hover:bg-amber-50 disabled:opacity-50',
                )}
              >
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
                  isDark ? 'border-yellow-400/30 bg-yellow-400/10' : 'border-amber-300 bg-amber-50',
                )}>
                  <Zap className={cn('h-3.5 w-3.5', isDark ? 'text-yellow-400' : 'text-amber-500')} />
                </span>
                <span className="font-bold text-[13px] tracking-wider uppercase">
                  {isCreatingQuick ? 'Creating…' : 'Quick Room'}
                </span>
              </button>

              {/* How to Play */}
              <button
                type="button"
                onClick={() => { setSidebarOpen(false); setHowToOpen(true); }}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all border border-transparent text-left',
                  isDark
                    ? 'text-slate-400 hover:bg-white/5 hover:text-white hover:border-white/10'
                    : 'text-foreground/70 hover:text-foreground hover:bg-violet-50',
                )}
              >
                <span className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
                  isDark ? 'border-[#c0c1ff]/30 bg-[#c0c1ff]/10' : 'border-violet-200 bg-violet-50',
                )}>
                  <HelpCircle className={cn('h-3.5 w-3.5', isDark ? 'text-[#c0c1ff]' : 'text-violet-500')} />
                </span>
                <span className="font-bold text-[13px] tracking-wider uppercase">How to Play</span>
              </button>

              {/* Past Rooms */}
              {rooms.length > 0 && (
                <div className="mt-5 pt-1">
                  <div className={cn(
                    'px-1 mb-2.5 text-[9px] font-bold uppercase tracking-[0.22em] flex items-center gap-2',
                    isDark ? 'text-[#2bb1ff]/50' : 'text-muted-foreground',
                  )}>
                    <div className={cn('h-px flex-1', isDark ? 'bg-[#2bb1ff]/15' : 'bg-border/30')} />
                    Past Rooms
                    <div className={cn('h-px flex-1', isDark ? 'bg-[#2bb1ff]/15' : 'bg-border/30')} />
                  </div>
                  <div className="space-y-0.5">
                    <AnimatePresence>
                      {rooms.slice(0, 5).map((room) => {
                        const cfg = STATUS_CFG[room.status] ?? STATUS_CFG.closed;
                        const subjectImg =
                          room.name.toLowerCase().includes('phys') ? '/ori2d/ori-physics.png' :
                          room.name.toLowerCase().includes('chem') ? '/ori2d/ori-chemistry.png' :
                          room.name.toLowerCase().includes('math') ? '/ori2d/ori-maths.png' :
                          room.name.toLowerCase().includes('bio')  ? '/ori2d/ori-biology.png' :
                          '/ori2d/ori-thinking.png';
                        return (
                          <motion.div
                            key={room.id}
                            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                            className={cn(
                              'flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer group border border-transparent transition-all',
                              isDark ? 'hover:bg-white/5 hover:border-white/8' : 'hover:bg-primary/5',
                            )}
                            onClick={() => { setSidebarOpen(false); resumeRoom(room); }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
                                isDark ? 'bg-[#111520] border-[#2bb1ff]/18' : 'border-border/20',
                              )}>
                                <img src={subjectImg} alt="" draggable={false} className="w-5 h-5 object-contain" />
                              </div>
                              <div className="min-w-0">
                                <p className={cn('text-[11px] font-bold truncate leading-tight', isDark ? 'text-white' : 'text-foreground')}>{room.name}</p>
                                <p className={cn('text-[9.5px] font-bold mt-0.5', cfg.darkText)}>{cfg.label}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={cn('text-[9px]', isDark ? 'text-slate-600' : 'text-muted-foreground')}>
                                {formatStudyRoomDateTime(room.created_at).split(',')[0]}
                              </span>
                              <ChevronRight className={cn('h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity', isDark ? 'text-slate-400' : 'text-muted-foreground')} />
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                  {rooms.length > 5 && (
                    <button className={cn(
                      'w-full mt-1.5 py-2 px-3.5 rounded-xl font-bold text-[10px] tracking-wider uppercase flex justify-between items-center transition-all border',
                      isDark
                        ? 'bg-[#111520] border-[#1a2333] text-slate-500 hover:bg-white/5 hover:text-white'
                        : 'neu-raised text-muted-foreground',
                    )}>
                      View All <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </nav>

          </aside>

          {/* ════════════════════════════════════════════════════════════════
              MAIN VIEWPORT  (full width after sidebar)
          ════════════════════════════════════════════════════════════════ */}
          <main className="flex-1 min-w-0 flex flex-col relative overflow-y-auto">

            {/* Ambient layers (dark only) */}
            {isDark && (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050810]/40 to-[#050810]/90 pointer-events-none z-0" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_35%,rgba(43,177,255,0.065),transparent)] pointer-events-none z-0" />
              </>
            )}

            {/* ── Top bar ─────────────────────────────────────────────── */}
            <header className={cn(
              'flex justify-between items-center px-4 sm:px-7 py-3 sm:py-4 z-30 relative flex-shrink-0',
              isDark ? '' : 'border-b border-border/10',
            )}>
              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={cn(
                  'lg:hidden flex items-center gap-2 text-sm font-bold px-3 py-2 rounded-xl border',
                  isDark ? 'bg-[#0d111a]/80 border-[#1a2333] text-slate-400' : 'neu-raised text-muted-foreground',
                )}
              >
                <UsersRound className="h-4 w-4" /> Menu
              </button>
              <div className="hidden lg:block" />

              {/* Right pill cluster */}
              <div className="flex items-center gap-2.5">
                {rooms.some(r => r.status === 'lobby' || r.status === 'in_test') && (
                  <div className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl border text-[11px] font-bold',
                    isDark
                      ? 'bg-[#0d111a]/80 border-[#1a2333] backdrop-blur-md'
                      : 'neu-raised',
                  )}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', isDark ? 'bg-[#2bb1ff] shadow-[0_0_6px_#2bb1ff]' : 'bg-primary')} />
                    <span className={isDark ? 'text-[#2bb1ff]' : 'text-primary'}>
                      {rooms.filter(r => r.status === 'lobby' || r.status === 'in_test').length} Active
                    </span>
                  </div>
                )}
              </div>
            </header>

            {/* ── Stage canvas ────────────────────────────────────────── */}
            <div className="flex-1 flex px-3 sm:px-5 pb-3 sm:pb-5 z-10 relative min-h-[460px] min-w-0 overflow-hidden">
              <div className={cn(
                'flex-1 flex flex-col relative rounded-2xl border overflow-hidden',
                isDark
                  ? 'bg-gradient-to-b from-[#0a1122]/45 to-[#050810]/85 border-[#1a2333] shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]'
                  : 'neu-inset border-transparent',
              )}>
                {/* Corner tech accents */}
                {isDark && (
                  <>
                    <div className="absolute top-0 left-0 w-14 h-14 border-t-2 border-l-2 border-[#2bb1ff]/25 rounded-tl-2xl pointer-events-none" />
                    <div className="absolute top-0 right-0 w-14 h-14 border-t-2 border-r-2 border-[#2bb1ff]/25 rounded-tr-2xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-14 h-14 border-b-2 border-l-2 border-[#2bb1ff]/25 rounded-bl-2xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-14 h-14 border-b-2 border-r-2 border-[#2bb1ff]/25 rounded-br-2xl pointer-events-none" />
                  </>
                )}

                {/* Title block */}
                <div className="text-center pt-5 sm:pt-8 px-4 sm:px-8 flex-shrink-0 relative z-10">
                  <h1 className={cn(
                    'text-3xl sm:text-4xl lg:text-5xl font-black tracking-wide leading-none',
                    isDark ? 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]' : 'text-foreground',
                  )}>
                    {isDark ? 'STUDY ROOM' : <>Study <span className="text-primary">Rooms</span></>}
                  </h1>
                  <p className={cn('text-xs sm:text-sm mt-2 sm:mt-2.5 tracking-wide', isDark ? 'text-slate-400' : 'text-muted-foreground')}>
                    Study together. Compete together. Grow together.
                  </p>
                  {/* Status pill */}
                  <div className={cn(
                    'inline-flex items-center gap-3.5 rounded-full px-5 sm:px-6 py-2 mt-4 sm:mt-5 border',
                    isDark
                      ? 'bg-[#0a0d14]/80 border-[#1a2333] backdrop-blur-md shadow-[0_4px_10px_rgba(0,0,0,0.5)]'
                      : 'bg-muted/30 border-border/20',
                  )}>
                    <span className={cn('font-bold text-sm tracking-widest', isDark ? 'text-[#2bb1ff]' : 'text-primary')}>LOBBY</span>
                    <div className={cn('w-px h-4', isDark ? 'bg-[#1a2333]' : 'bg-border/30')} />
                    <div className="flex items-center gap-2">
                      <Users className={cn('h-3.5 w-3.5', isDark ? 'text-slate-500' : 'text-muted-foreground')} />
                      <span className={cn('font-bold text-sm', isDark ? 'text-white' : 'text-foreground')}>
                        {rooms.filter(r => r.status === 'lobby' || r.status === 'in_test').length} active
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Mascots ────────────────────────────────────────── */}
                <div className="flex-1 relative min-h-0 overflow-hidden">
                  {/* Planet ambient */}
                  {isDark && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-blue-900/10 rounded-full blur-2xl border border-blue-500/8 pointer-events-none" />
                  )}

                  {/* Left: Chemistry */}
                  <div className="absolute left-[6%] sm:left-[8%] bottom-[14%] w-20 sm:w-28 lg:w-32 z-10">
                    {isDark && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-[#0a1122] rounded-[50%] border border-cyan-500/25 shadow-[0_0_14px_rgba(0,255,255,0.18)]" />
                    )}
                    <img src="/ori2d/ori-chemistry.png" alt="Chemistry" draggable={false}
                      className={cn('w-full h-auto select-none float-b', isDark && 'drop-shadow-[0_10px_22px_rgba(0,255,255,0.3)]')} />
                  </div>

                  {/* Center: Physics on pedestal */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-[10%] z-20 flex flex-col items-center">
                    {isDark ? (
                      <div className="relative w-40 sm:w-52 lg:w-56 h-[44px] sm:h-[54px] lg:h-[58px] bg-[#0a1122] rounded-[50%] border-2 border-[#2bb1ff]/40 platform-glow">
                        <div className="ped-ring" />
                        <div className="ped-ring" />
                        <div className="ped-ring" />
                        <div className="absolute inset-[14%] rounded-[50%] border border-[#2bb1ff]/28" />
                        <div className="absolute inset-[28%] rounded-[50%] border border-[#00f0ff]/35 bg-[#2bb1ff]/06" />
                        {/* Physics mascot hovers above */}
                        <div className="absolute -top-36 sm:-top-48 lg:-top-52 left-1/2 -translate-x-1/2 w-32 sm:w-44 lg:w-48">
                          <img src="/ori2d/ori-physics.png" alt="Physics" draggable={false}
                            className="w-full h-auto select-none float-a drop-shadow-[0_16px_28px_rgba(43,177,255,0.5)]" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex flex-col items-center">
                        <div className="relative w-32 sm:w-44 lg:w-48 z-10">
                          <img src="/ori2d/ori-physics.png" alt="Physics" draggable={false} className="w-full h-auto select-none float-a" />
                        </div>
                        {/* Light-mode pedestal rings */}
                        <div className="relative w-36 sm:w-48 lg:w-52 h-[44px] sm:h-[50px] lg:h-[52px] rounded-[50%] border-2 border-primary/30 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.15)] -mt-4">
                          <div className="absolute top-1/2 left-1/2 w-full h-full rounded-[50%] border border-primary/20 animate-[ring-pulse_2.6s_ease-out_infinite]" style={{transform:'translate(-50%,-50%)'}} />
                          <div className="absolute top-1/2 left-1/2 w-full h-full rounded-[50%] border border-primary/15 animate-[ring-pulse_2.6s_ease-out_infinite_0.87s]" style={{transform:'translate(-50%,-50%)'}} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Maths */}
                  <div className="absolute right-[6%] sm:right-[8%] bottom-[8%] w-24 sm:w-32 lg:w-36 z-10">
                    {isDark && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#0a1122] rounded-[50%] border border-yellow-500/25 shadow-[0_0_14px_rgba(250,204,21,0.18)]" />
                    )}
                    <img src="/ori2d/ori-maths.png" alt="Maths" draggable={false}
                      className={cn('w-full h-auto select-none float-c', isDark && 'drop-shadow-[0_10px_22px_rgba(250,204,21,0.3)]')} />
                  </div>

                  {/* Background: Biology (blurred, atmospheric) */}
                  <div className="absolute right-[24%] sm:right-[26%] top-[4%] w-20 sm:w-28 z-0 opacity-65">
                    <img src="/ori2d/ori-biology.png" alt="Biology" draggable={false}
                      className={cn('w-full h-auto select-none float-d', isDark && 'drop-shadow-[0_5px_12px_rgba(52,211,153,0.3)] blur-[1px]')} />
                  </div>

                  {/* Far left background: Thinking (very atmospheric) */}
                  <div className="hidden sm:block absolute left-[2%] top-[8%] w-20 z-0 opacity-40">
                    <img src="/ori2d/ori-thinking.png" alt="" draggable={false}
                      className={cn('w-full h-auto select-none float-b', isDark && 'blur-[1.5px] drop-shadow-[0_4px_10px_rgba(43,177,255,0.2)]')} />
                  </div>

                  {/* Upper right: Cheerful */}
                  <div className="hidden sm:block absolute right-[3%] top-[6%] w-24 z-0 opacity-55">
                    <img src="/ori2d/ori-cheerful.png" alt="" draggable={false}
                      className={cn('w-full h-auto select-none float-c', isDark && 'blur-[1px] drop-shadow-[0_4px_10px_rgba(0,240,255,0.25)]')} />
                  </div>

                  {/* Upper center-left: Happy */}
                  <div className="hidden sm:block absolute left-[30%] top-[2%] w-16 z-0 opacity-35">
                    <img src="/ori2d/ori-happy.png" alt="" draggable={false}
                      className={cn('w-full h-auto select-none float-d', isDark && 'blur-[2px] drop-shadow-[0_3px_8px_rgba(43,177,255,0.15)]')} />
                  </div>
                </div>

                {/* ── Footer ──────────────────────────────────────────── */}
                <div className="flex-shrink-0 px-4 sm:px-8 pb-5 sm:pb-7 pt-3 z-20 relative">

                  {/* Code input + Join */}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      void joinByCode();
                    }}
                    className="flex items-center justify-center gap-3"
                  >
                    <div className={cn(
                      'flex items-center gap-2.5 px-4 py-0 rounded-xl border h-[52px] flex-1 max-w-xs',
                      isDark
                        ? 'bg-[#0a0d14]/80 border-[#1a2333] backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.5)]'
                        : 'neu-inset',
                    )}>
                      <span className={cn('text-[9px] font-black uppercase tracking-[0.22em] flex-shrink-0', isDark ? 'text-slate-600' : 'text-muted-foreground')}>
                        CODE
                      </span>
                      <div className={cn('w-px h-4', isDark ? 'bg-[#1a2333]' : 'bg-border/30')} />
                      <input
                        type="text"
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                        placeholder="ENTER CODE"
                        autoCapitalize="characters"
                        spellCheck={false}
                        className={cn(
                          'flex-1 bg-transparent outline-none font-black tracking-[0.22em] text-sm placeholder:font-bold',
                          isDark
                            ? 'text-[#2bb1ff] placeholder:text-slate-700 caret-[#2bb1ff]'
                            : 'text-primary placeholder:text-muted-foreground/40 caret-primary',
                        )}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isJoining}
                      className={cn(
                        'flex items-center gap-2 sm:gap-2.5 px-5 sm:px-8 h-[52px] rounded-xl font-black text-sm tracking-widest uppercase transition-all border border-white/15 group flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed',
                        isDark
                          ? 'bg-gradient-to-r from-[#2bb1ff] to-[#006495] text-white shadow-[0_0_28px_rgba(43,177,255,0.38)] hover:shadow-[0_0_42px_rgba(43,177,255,0.6)] hover:scale-[1.02] active:scale-[0.98]'
                          : 'bg-primary text-primary-foreground shadow-[2px_2px_8px_hsl(var(--neu-shadow))] hover:-translate-y-0.5',
                      )}
                    >
                      {isJoining ? 'JOINING…' : <>JOIN <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>}
                    </button>
                  </form>

                </div>

              </div>
            </div>
          </main>

        </div>
      </div>

      {/* ── How to Play modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {howToOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setHowToOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="How to use Study Rooms"
              className={cn(
                'relative w-full max-w-lg rounded-2xl border overflow-hidden',
                isDark
                  ? 'bg-[#0a0d14]/95 border-[#1a2333] shadow-[0_0_50px_rgba(43,177,255,0.18)] backdrop-blur-2xl'
                  : 'bg-card border-border/30 shadow-2xl',
              )}
            >
              {/* Accent bar */}
              {isDark && (
                <div className="absolute top-0 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-[#2bb1ff] to-transparent opacity-60" />
              )}

              {/* Header */}
              <div className={cn('flex items-center justify-between px-7 pt-6 pb-4 border-b', isDark ? 'border-[#1a2333]' : 'border-border/20')}>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border',
                    isDark ? 'border-[#2bb1ff]/40 bg-[#2bb1ff]/10' : 'border-primary/20 bg-primary/10',
                  )}>
                    <HelpCircle className={cn('h-4.5 w-4.5', isDark ? 'text-[#2bb1ff]' : 'text-primary')} />
                  </span>
                  <div>
                    <h2 className={cn('text-base font-black tracking-wide uppercase', isDark ? 'text-white' : 'text-foreground')}>
                      How Study Rooms Work
                    </h2>
                    <p className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-500' : 'text-muted-foreground')}>
                      Study together · Compete together · Grow together
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHowToOpen(false)}
                  aria-label="Close"
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0',
                    isDark ? 'border-[#1a2333] text-slate-500 hover:text-white hover:border-white/20' : 'border-border/30 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Steps */}
              <div className="px-7 py-6 flex flex-col gap-4">
                {[
                  { Icon: Plus,       title: 'Create or Join a room', desc: 'Start your own room, or enter a friend’s room code to join theirs.' },
                  { Icon: UsersRound, title: 'Gather in the lobby',   desc: 'Everyone waits in the lobby until the host kicks off the test.' },
                  { Icon: Zap,        title: 'Compete live',          desc: 'Answer the same questions in real time and race to the top.' },
                  { Icon: Trophy,     title: 'See the leaderboard',   desc: 'When the test ends, check rankings and review your results.' },
                ].map((step, i) => (
                  <div key={step.title} className="flex items-start gap-3.5">
                    <span className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border font-black text-xs relative',
                      isDark ? 'border-[#1a2333] bg-[#111520] text-[#2bb1ff]' : 'border-border/30 bg-muted/40 text-primary',
                    )}>
                      <step.Icon className="h-4 w-4" />
                      <span className={cn(
                        'absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black',
                        isDark ? 'bg-[#2bb1ff] text-[#050810]' : 'bg-primary text-primary-foreground',
                      )}>{i + 1}</span>
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className={cn('text-[13px] font-bold leading-tight', isDark ? 'text-white' : 'text-foreground')}>{step.title}</p>
                      <p className={cn('text-[12px] mt-1 leading-snug', isDark ? 'text-slate-400' : 'text-muted-foreground')}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              <div className={cn('flex items-center gap-3 px-7 py-5 border-t', isDark ? 'border-[#1a2333] bg-[#0a0d14]/60' : 'border-border/20 bg-muted/20')}>
                <Link
                  href="/study-rooms/create"
                  onClick={() => setHowToOpen(false)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-black text-[13px] tracking-wider uppercase transition-all border',
                    isDark
                      ? 'bg-gradient-to-r from-[#2bb1ff] to-[#006495] text-white border-white/15 shadow-[0_0_22px_rgba(43,177,255,0.3)] hover:scale-[1.02]'
                      : 'bg-primary text-primary-foreground border-transparent hover:-translate-y-0.5',
                  )}
                >
                  <Plus className="h-4 w-4" /> Create Room
                </Link>
                <Link
                  href="/study-rooms/join"
                  onClick={() => setHowToOpen(false)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl font-black text-[13px] tracking-wider uppercase transition-all border',
                    isDark
                      ? 'bg-[#111520] text-slate-200 border-[#1a2333] hover:border-[#2bb1ff]/40 hover:text-white'
                      : 'neu-raised text-foreground',
                  )}
                >
                  <LogIn className="h-4 w-4" /> Join Room
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
