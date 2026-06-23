'use client';

import Profile from '@/sections/Profile';
import TeacherProfile from '@/sections/TeacherProfile';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface ProfileStats {
  tests_taken: number;
  study_hours: number;
  global_rank: number | null;
  subject_progress: Array<{ subject: string; accuracy: number }>;
  overall_accuracy: number;
  achievements: {
    first_test: boolean;
    streak_7: boolean;
    doubt_master: boolean;
    top_100: boolean;
    perfect_score: boolean;
    streak_30: boolean;
  };
}

interface ProfileClientProps {
  initialProfileStats: ProfileStats | null;
  premiumEnabled?: boolean;
  socialEnabled?: boolean;
}

export default function ProfileClient({ initialProfileStats, premiumEnabled, socialEnabled }: ProfileClientProps) {
  const { user, streakData, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  if (user.role === 'teacher') {
    return (
      <TeacherProfile
        user={user}
        onBack={() => router.push('/teacher')}
        onLogout={logout}
      />
    );
  }

  return (
    <Profile
      user={user}
      initialProfileStats={initialProfileStats}
      streakData={streakData}
      premiumEnabled={premiumEnabled}
      socialEnabled={socialEnabled}
      onBack={() => router.push('/dashboard')}
      onUpgrade={() => router.push('/premium')}
    />
  );
}
