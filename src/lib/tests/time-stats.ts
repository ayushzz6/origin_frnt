import type { TestResult, UserAnswer } from '@/types';

export interface SubjectTimeBreakdownEntry {
  name: string;
  time: number;
}

function getSafeSeconds(value: number | null | undefined): number {
  return Math.max(0, Math.round(value ?? 0));
}

export function buildSubjectTimeBreakdown(
  subjectStats: TestResult['subjectStats'],
): SubjectTimeBreakdownEntry[] {
  return Object.entries(subjectStats ?? {}).map(([subject, stats]) => ({
    name: subject,
    time: getSafeSeconds(stats.total_time_spent),
  }));
}

export function hasSavedTestResponse(answer: Pick<UserAnswer, 'selectedOption' | 'selectedOptions' | 'matrixPairs' | 'answerText'>): boolean {
  return (
    answer.selectedOption !== null ||
    Boolean(answer.selectedOptions?.length) ||
    Boolean(answer.matrixPairs?.length) ||
    Boolean(answer.answerText?.trim())
  );
}

export function shouldSubmitTestAnswer(answer: UserAnswer): boolean {
  return hasSavedTestResponse(answer) || answer.isMarkedForReview || getSafeSeconds(answer.timeSpent) > 0;
}
