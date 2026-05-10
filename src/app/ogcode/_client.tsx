'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import OGCodeList, { type UserStats } from '@/sections/OGCodeList';
import type { PracticeQuestionPage, SubjectRank } from '@/types';

interface OGCodeClientProps {
  initialQuestionPage: PracticeQuestionPage | null;
  initialSubjectRanks: SubjectRank[] | null;
  initialUserStats: UserStats | null;
  initialChapters: string[] | null;
}

export default function OGCodeClient({
  initialQuestionPage,
  initialSubjectRanks,
  initialUserStats,
  initialChapters,
}: OGCodeClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <OGCodeList
      user={user}
      initialQuestionPage={initialQuestionPage}
      initialSubjectRanks={initialSubjectRanks}
      initialUserStats={initialUserStats}
      initialChapters={initialChapters}
      onSelectQuestion={(id) => {
        if (id === 'leaderboard') {
          router.push('/leaderboard');
        } else {
          router.push(`/ogcode/${id}`);
        }
      }}
    />
  );
}
