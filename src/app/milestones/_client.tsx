'use client';

import { useRouter } from 'next/navigation';
import MilestonesPage from '@/sections/MilestonesPage';

interface MilestonesClientProps {
  initialPoints: number;
}

export default function MilestonesClient({ initialPoints }: MilestonesClientProps) {
  const router = useRouter();
  return (
    <MilestonesPage
      userPoints={initialPoints}
      onBack={() => router.push('/dashboard')}
    />
  );
}
