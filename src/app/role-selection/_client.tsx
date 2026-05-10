'use client';

import { useRouter } from 'next/navigation';
import RoleSelection from '@/sections/RoleSelection';

export default function RoleSelectionClient() {
  const router = useRouter();
  return (
    <RoleSelection
      onSelectRole={(role) => router.push(`/auth?role=${role}`)}
      onBack={() => router.push('/')}
    />
  );
}
