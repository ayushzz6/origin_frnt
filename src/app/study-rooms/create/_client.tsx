'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiCall } from '@/lib/api';

export default function CreateStudyRoomClient() {
  const [name, setName] = useState('Study Room');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const createRoom = async (): Promise<void> => {
    setIsCreating(true);
    try {
      const payload = await apiCall('/study-rooms', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      router.push(`/study-rooms/${payload.room.id}/lobby`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create room.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white">
            <UsersRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black">Create Study Room</h1>
            <p className="text-sm text-slate-500">Set a room name and invite friends from the lobby.</p>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="room-name">Room Name</Label>
          <Input id="room-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </div>
        <Button className="mt-6 w-full" disabled={isCreating || name.trim().length < 2} onClick={createRoom}>
          {isCreating ? 'Creating...' : 'Create Room'}
        </Button>
      </section>
    </main>
  );
}
