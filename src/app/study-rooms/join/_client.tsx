'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
      toast.error(error instanceof Error ? error.message : 'Could not join room.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
          <LogIn className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-black">Join Study Room</h1>
        <p className="mb-6 mt-2 text-sm text-slate-500">Enter the 6-character invite code.</p>
        <div className="flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={(value) => setCode(value.toUpperCase())}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="mt-6 w-full" disabled={isJoining || code.length !== 6} onClick={join}>
          {isJoining ? 'Joining...' : 'Join Room'}
        </Button>
      </section>
    </main>
  );
}
