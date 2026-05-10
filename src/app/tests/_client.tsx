'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import TestList from '@/sections/TestList';
import type { TestPreview } from '@/types';

interface TestsClientProps {
  initialTests: TestPreview[];
}

export default function TestsClient({ initialTests }: TestsClientProps) {
  // AuthProvider is seeded from the server layout, so `user` is non-null on first render.
  const { user } = useAuth();
  const router = useRouter();

  return (
    <TestList
      user={user!}
      initialTests={initialTests}
      onStartTest={(test) => router.push(`/tests/${test.id}`)}
      onViewAnalysis={(test) => router.push(`/tests/${test.id}/result`)}
      onBack={() => router.push('/dashboard')}
    />
  );
}
