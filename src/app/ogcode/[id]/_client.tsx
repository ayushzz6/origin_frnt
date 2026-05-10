'use client';

import React from 'react';
import OGCodeWorkspace from '@/sections/OGCodeWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useTimeTracker } from '@/hooks/useTimeTracker';
import type { PracticeQuestion } from '@/types';

interface Props {
  questionId: string;
  initialQuestion: PracticeQuestion | null;
}

export default function OGCodeClient({ questionId, initialQuestion }: Props) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { setTimeMode } = useTimeTracker(!!user);

  if (!user) return null;

  return (
    <OGCodeWorkspace
      questionId={questionId}
      initialQuestion={initialQuestion}
      onBack={() => router.back()}
      user={user}
      onRefreshUser={refreshUser}
      setTimeMode={setTimeMode}
    />
  );
}
