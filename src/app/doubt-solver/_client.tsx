'use client';

import { useRouter } from 'next/navigation';

import DoubtSolver from '@/sections/DoubtSolver';
import { useAuth } from '@/context/AuthContext';

export default function DoubtSolverClient() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) return null;

  return <DoubtSolver user={user} onBack={() => router.push('/dashboard')} />;
}
