'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, ArrowLeft, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { apiCall } from '@/lib/api';

export default function JoinStudyRoomClient() {
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  const join = async (): Promise<void> => {
    setIsJoining(true);
    try {
      const payload = await apiCall('/study-rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      router.push(`/study-rooms/${payload.roomId}/lobby`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not join room.';
      // Rotating room codes change every 60s — guide the student to the new one.
      if (/changed/i.test(message)) {
        setCode('');
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

        <div className="neu-raised rounded-3xl p-8 text-center">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>

          <h1 className="text-xl font-black">Join a Room</h1>
          <p className="mt-2 mb-7 text-sm text-muted-foreground">Enter the 6-character invite code from your teacher or friend.</p>

          {/* OTP input */}
          <div className="neu-inset rounded-2xl p-4 inline-block mb-8">
            <InputOTP maxLength={6} value={code} onChange={(value) => setCode(value.toUpperCase())}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="h-12 w-12 text-lg font-black"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Join button */}
          <button
            type="button"
            disabled={isJoining || code.length !== 6}
            onClick={join}
            className="w-full bg-primary text-primary-foreground rounded-xl px-6 py-3.5 font-black text-sm flex items-center justify-center gap-2 shadow-[3px_3px_8px_hsl(var(--neu-shadow))] transition-transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <LogIn className="h-4 w-4" />
            {isJoining ? 'Joining…' : 'Join Room'}
          </button>
        </div>
      </motion.div>
    </main>
  );
}
