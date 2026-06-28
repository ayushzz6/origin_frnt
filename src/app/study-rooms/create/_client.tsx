'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound, ArrowLeft, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

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
    <main className="min-h-screen neu-surface flex items-center justify-center px-4 py-8 text-foreground font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link
          href="/study-rooms"
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to rooms
        </Link>

        <div className="neu-raised rounded-3xl p-8">
          {/* Header */}
          <div className="mb-7 flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <UsersRound className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black">Create Study Room</h1>
              <p className="text-sm text-muted-foreground">Set a name and invite friends from the lobby.</p>
            </div>
          </div>

          {/* Room name input */}
          <div className="mb-6 space-y-2">
            <label htmlFor="room-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Room Name
            </label>
            <div className="neu-inset rounded-xl px-4 py-3">
              <input
                id="room-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Create button */}
          <button
            type="button"
            disabled={isCreating || name.trim().length < 2}
            onClick={createRoom}
            className="w-full bg-primary text-primary-foreground rounded-xl px-6 py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-[3px_3px_8px_hsl(var(--neu-shadow))] transition-transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4" />
            {isCreating ? 'Creating…' : 'Create Room'}
          </button>
        </div>
      </motion.div>
    </main>
  );
}
