'use client';

import React from 'react';
import TestInterface from '@/sections/TestInterface';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { Test, TestResult } from '@/types';

interface Props {
  testId: string;
  initialTest: Test;
}

export default function TestClient({ testId, initialTest }: Props) {
  const { refreshUser } = useAuth();
  const router = useRouter();

  const handleComplete = (result: TestResult): void => {
    sessionStorage.setItem(`origin_test_result_${testId}`, JSON.stringify(result));
    if (result.id) {
      sessionStorage.setItem(`origin_test_result_id_${result.id}`, JSON.stringify(result));
    }
    void refreshUser();
    const target = result.id
      ? `/tests/${testId}/result?result=${encodeURIComponent(result.id)}`
      : `/tests/${testId}/result`;
    window.location.assign(target);
  };

  return (
    <TestInterface
      test={initialTest}
      onComplete={handleComplete}
      onExit={() => router.push('/tests')}
    />
  );
}
