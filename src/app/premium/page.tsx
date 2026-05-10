'use client';

import Premium from '@/sections/Premium';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function PremiumPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const handleSubscribe = async (plan: string) => {
    if (!user) {
      router.push('/role-selection');
      return;
    }

    // In original project, it just updated the local user state
    // We should probably call an API, but for now matching App.tsx logic
    toast.success(`Subscribed to ${plan} plan!`);
    void refreshUser();
    router.push('/dashboard');
  };

  return (
    <Premium
      user={user}
      onBack={() => router.back()}
      onSubscribe={handleSubscribe}
    />
  );
}
