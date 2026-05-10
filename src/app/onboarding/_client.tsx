'use client';

import OnboardingPage from '@/sections/OnboardingPage';
import TeacherOnboardingPage from '@/sections/TeacherOnboardingPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function OnboardingClient() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const handleComplete = async () => {
    void refreshUser();
    router.replace('/dashboard');
  };

  return user.role === 'teacher' ? (
    <TeacherOnboardingPage user={user} onComplete={handleComplete} />
  ) : (
    <OnboardingPage user={user} onComplete={handleComplete} />
  );
}
