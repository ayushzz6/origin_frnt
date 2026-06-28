'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Medal, Award, ArrowLeft, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

import { DeleteRoomButton } from '@/components/study-rooms/DeleteRoomButton';
import { RoomDppPanel, type RoomDppSummary } from '@/components/study-rooms/RoomDppPanel';
import { apiCall } from '@/lib/api';
import { isStudyRoomUnavailableError } from '@/lib/study-rooms/errors';
import { cn } from '@/lib/utils';
import type { RoomLeaderboardRow, RoomSummary } from '@/server/study-rooms';

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-orange-500" />;
  return <span className="flex h-5 w-5 items-center justify-center text-sm font-black text-muted-foreground">{rank}</span>;
}

export default function RoomLeaderboardClient({
  room,
  currentUserId,
  initialLeaderboard,
  initialDpps,
}: {
  room: RoomSummary;
  currentUserId: string;
  initialLeaderboard: RoomLeaderboardRow[];
  initialDpps: RoomDppSummary[];
}) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [dpps, setDpps] = useState(initialDpps);
  const isAdmin = room.admin_user_id === currentUserId;

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

    const refresh = async (): Promise<void> => {
      try {
        const payload = await apiCall(`/study-rooms/${room.id}/leaderboard`);
        if (isDisposed) return;
        setLeaderboard(payload.leaderboard ?? []);
        setDpps(payload.dpps ?? []);
      } catch (error) {
        if (isStudyRoomUnavailableError(error)) {
          redirectUnavailable();
        }
      }
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, [room.id, router]);

  const deleteRoom = async (): Promise<void> => {
    await apiCall(`/study-rooms/${room.id}`, { method: 'DELETE' });
    router.push('/study-rooms');
  };

  return (
    <main className="min-h-screen neu-surface px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/study-rooms"
              className="mb-3 flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Rooms
            </Link>
            <h1 className="text-3xl font-black tracking-tight">{room.name} Leaderboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ranked by score, then completion time.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
              {room.status.replace('_', ' ')}
            </span>
            {isAdmin && <DeleteRoomButton roomName={room.name} onDelete={deleteRoom} />}
          </div>
        </header>

        <section className="neu-raised rounded-2xl p-5">
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div
                key={entry.user_id}
                className={cn(
                  'flex items-center gap-4 rounded-xl p-4',
                  entry.rank <= 3 ? 'neu-raised' : 'neu-inset',
                  entry.is_me && 'ring-2 ring-primary/30',
                )}
              >
                <div className="w-8 flex items-center justify-center">
                  <RankIcon rank={entry.rank} />
                </div>

                {/* Avatar */}
                <div className={cn(
                  'h-11 w-11 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0',
                  entry.rank === 1 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                  entry.rank === 2 ? 'bg-slate-400/20 text-slate-500' :
                  entry.rank === 3 ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' :
                  'bg-primary/10 text-primary',
                )}>
                  {entry.display_name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate font-black">{entry.display_name}</p>
                    {entry.is_me && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                        You
                      </span>
                    )}
                    {entry.auto_submitted && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground">
                        Auto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.finished_at ? `Finished in ${entry.time_taken_seconds ?? 0}s` : 'Still in progress'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-black text-primary">{entry.score ?? 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Score</p>
                </div>

                {entry.is_me && room.custom_test_id && entry.test_result_id && (
                  <Link
                    href={`/tests/${room.custom_test_id}/result?result=${encodeURIComponent(entry.test_result_id)}`}
                    className="flex items-center gap-1.5 neu-raised rounded-xl px-3 py-2 text-xs font-bold text-foreground hover:-translate-y-0.5 transition-all"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Analysis
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <RoomDppPanel dpps={dpps} />
      </div>
    </main>
  );
}
