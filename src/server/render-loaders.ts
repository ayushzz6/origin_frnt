import {
  getOgcodeIndexData,
  getChallengeOfTheDay,
  listGeneratedDpps,
  getOgcodeLeaderboard,
  getOgcodeSubjectRanks,
  getOgcodeUserStats,
  getPracticeQuestionDetail,
  getSingleResult,
  getTestDetail,
  listOgcodeQuestionChapters,
  listOgcodeQuestionPage,
  listOgcodeQuestions,
  listTestPreviews,
  listTestResults,
  type OgcodeQuestionListFilters,
} from "@/server/assessments";
import { dbGetTasks } from "@/server/db-users";
import { buildPointsSummary } from "@/server/gamification";
import { readStoreAsync } from "@/server/store";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { buildUserStatsSnapshot, serializeTask } from "@/server/users";

async function requireStoredUser(userId: string) {
  const store = await readStoreAsync();
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error(`Stored user ${userId} was not found.`);
  }
  return { store, user };
}

export async function listTestsForRender(userId: string) {
  const { store, user } = await requireStoredUser(userId);
  return listTestPreviews(store, user);
}

export async function getTestDetailForRender(userId: string, testId: string) {
  const { store, user } = await requireStoredUser(userId);
  return getTestDetail(store, user, testId);
}

export async function listTestResultsForRender(userId: string, testId: string) {
  const { store, user } = await requireStoredUser(userId);
  return listTestResults(store, user, testId);
}

export async function getSingleResultForRender(userId: string, resultId: string) {
  const { store, user } = await requireStoredUser(userId);
  return getSingleResult(store, user, resultId);
}

export async function listTasksForRender(userId: string) {
  if (isUserPostgresConfigured()) {
    try {
      const tasks = await dbGetTasks(userId);
      return tasks.map(serializeTask);
    } catch (error) {
      console.error(
        '[render-loaders] DB task preload failed, falling back to in-memory seed',
        error instanceof Error ? error.message : error,
      );
    }
  }

  const store = await readStoreAsync();
  return store.tasks
    .filter((task) => task.userId === userId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map(serializeTask);
}

export async function getPointsSummaryForRender(userId: string) {
  const { store } = await requireStoredUser(userId);
  return buildPointsSummary(store, userId);
}

export async function getProfileStatsForRender(userId: string) {
  const { store, user } = await requireStoredUser(userId);
  return buildUserStatsSnapshot(store, user);
}

export async function getChallengeOfTheDayForRender(userId: string) {
  const { store, user } = await requireStoredUser(userId);
  return getChallengeOfTheDay(store, user);
}

export type GeneratedDppForRender = Awaited<ReturnType<typeof listGeneratedDppsForRender>>[number];

export async function listGeneratedDppsForRender(userId: string) {
  const { store, user } = await requireStoredUser(userId);
  return listGeneratedDpps(store, user);
}

export async function listOgcodeQuestionsForRender(
  userId: string,
  filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
) {
  const { store, user } = await requireStoredUser(userId);
  return listOgcodeQuestions(store, user, filters);
}

export async function listOgcodeQuestionPageForRender(
  userId: string,
  filters: OgcodeQuestionListFilters,
) {
  const { store, user } = await requireStoredUser(userId);
  return listOgcodeQuestionPage(store, user, filters);
}

export async function getOgcodeIndexDataForRender(
  userId: string,
  filters: OgcodeQuestionListFilters,
) {
  const { store, user } = await requireStoredUser(userId);
  return getOgcodeIndexData(store, user, filters);
}

export async function getPracticeQuestionDetailForRender(userId: string, questionId: string) {
  const { store, user } = await requireStoredUser(userId);
  return getPracticeQuestionDetail(store, user, questionId);
}

export async function getOgcodeLeaderboardForRender(userId: string, subject: string | null) {
  const { store, user } = await requireStoredUser(userId);
  return getOgcodeLeaderboard(store, user, subject);
}

export async function getOgcodeUserStatsForRender(userId: string) {
  const { store, user } = await requireStoredUser(userId);
  return getOgcodeUserStats(store, user);
}

export async function getOgcodeSubjectRanksForRender(userId: string) {
  const { store, user } = await requireStoredUser(userId);
  return getOgcodeSubjectRanks(store, user);
}

export async function listOgcodeQuestionChaptersForRender(userId: string, subject: string) {
  const { store, user } = await requireStoredUser(userId);
  return listOgcodeQuestionChapters(store, user, subject);
}
