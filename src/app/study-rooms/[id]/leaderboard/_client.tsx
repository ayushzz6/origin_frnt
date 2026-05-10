'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Medal, Award, ArrowLeft, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  return <span className="flex h-5 w-5 items-center justify-center text-sm font-black text-slate-500">{rank}</span>;
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
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-3">
              <Link href="/study-rooms"><ArrowLeft className="h-4 w-4" /> Rooms</Link>
            </Button>
            <h1 className="text-3xl font-black tracking-tight">{room.name} Leaderboard</h1>
            <p className="mt-2 text-sm text-slate-500">Ranked by score, then completion time.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge className="w-fit rounded-md">{room.status.replace('_', ' ')}</Badge>
            {isAdmin && <DeleteRoomButton roomName={room.name} onDelete={deleteRoom} />}
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <div
                key={entry.user_id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-4',
                  entry.is_me ? 'border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30' : 'border-slate-100 dark:border-slate-800',
                )}
              >
                <div className="w-8"><RankIcon rank={entry.rank} /></div>
                <Avatar className="h-11 w-11">
                  <AvatarFallback className="bg-blue-600 font-black text-white">
                    {entry.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-black">{entry.display_name}</p>
                    {entry.is_me && <Badge className="h-5 rounded-md px-1.5 text-[10px]">You</Badge>}
                    {entry.auto_submitted && <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px]">Auto</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">
                    {entry.finished_at ? `Finished in ${entry.time_taken_seconds ?? 0}s` : 'Still in progress'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-blue-600">{entry.score ?? 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Score</p>
                </div>
                {entry.is_me && room.custom_test_id && entry.test_result_id && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/tests/${room.custom_test_id}/result?result=${encodeURIComponent(entry.test_result_id)}`}>
                      <BarChart3 className="h-4 w-4" />
                      Analysis
                    </Link>
                  </Button>
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
