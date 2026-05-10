'use client';

import DPPView from '@/sections/DPPView';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { GeneratedDppForRender } from '@/server/render-loaders';

interface DPPClientProps {
  initialDpps: GeneratedDppForRender[] | null;
}

export default function DPPClient({ initialDpps }: DPPClientProps) {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return <DPPView user={user} initialDpps={initialDpps} onBack={() => router.push('/dashboard')} />;
}
