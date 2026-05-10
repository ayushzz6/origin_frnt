'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn, UsersRound, Clock3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeleteRoomButton } from '@/components/study-rooms/DeleteRoomButton';
import { apiCall } from '@/lib/api';
import { formatStudyRoomDateTime } from '@/lib/study-rooms/date-format';
import type { RoomSummary } from '@/server/study-rooms';

export default function StudyRoomsClient({
  initialRooms,
  currentUserId,
}: {
  initialRooms: RoomSummary[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);

  const resumeRoom = (room: RoomSummary): void => {
    const path = room.status === 'lobby'
      ? `/study-rooms/${room.id}/lobby`
      : room.status === 'in_test'
        ? `/study-rooms/${room.id}/test`
        : `/study-rooms/${room.id}/leaderboard`;
    router.push(path);
  };

  const createQuickRoom = async (): Promise<void> => {
    const payload = await apiCall('/study-rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'Study Room' }),
    });
    router.push(`/study-rooms/${payload.room.id}/lobby`);
  };

  const deleteRoom = async (roomId: string): Promise<void> => {
    await apiCall(`/study-rooms/${roomId}`, { method: 'DELETE' });
    setRooms((currentRooms) => currentRooms.filter((room) => room.id !== roomId));
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.24em] text-blue-600">Multiplayer Tests</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Study Rooms</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/study-rooms/join"><LogIn className="h-4 w-4" /> Join</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/study-rooms/create"><Plus className="h-4 w-4" /> Create</Link>
            </Button>
            <Button onClick={createQuickRoom}><UsersRound className="h-4 w-4" /> Quick Room</Button>
          </div>
        </header>

        <section className="grid gap-3">
          {rooms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-800">
              <UsersRound className="mx-auto mb-4 h-10 w-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-500">No active rooms yet.</p>
            </div>
          ) : rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="truncate font-black">{room.name}</h2>
                  <Badge className="rounded-md">{room.status.replace('_', ' ')}</Badge>
                </div>
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  Created {formatStudyRoomDateTime(room.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {room.admin_user_id === currentUserId && (
                  <DeleteRoomButton
                    roomName={room.name}
                    label={`Delete ${room.name}`}
                    iconOnly
                    size="icon-sm"
                    onDelete={() => deleteRoom(room.id)}
                  />
                )}
                <Button variant="outline" size="sm" onClick={() => resumeRoom(room)}>Open</Button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
