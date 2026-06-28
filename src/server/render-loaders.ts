import { unstable_cache } from "next/cache";

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

// ---------------------------------------------------------------------------
// All exported render-loaders are wrapped with unstable_cache so that:
//   • Subsequent SSR requests within the TTL window skip the Postgres round-trip
//   • Cold serverless instances share the cached payload via Next.js data cache
//   • Arguments (userId + any filters) are automatically part of the cache key
// ---------------------------------------------------------------------------

export const listTestsForRender = unstable_cache(
  async (userId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return listTestPreviews(store, user);
  },
  ["rl:list-tests"],
  { revalidate: 30, tags: ["tests"] },
);

export const getTestDetailForRender = unstable_cache(
  async (userId: string, testId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return getTestDetail(store, user, testId);
  },
  ["rl:test-detail"],
  { revalidate: 60, tags: ["tests"] },
);

export const listTestResultsForRender = unstable_cache(
  async (userId: string, testId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return listTestResults(store, user, testId);
  },
  ["rl:test-results"],
  { revalidate: 60, tags: ["test-results"] },
);

export const getSingleResultForRender = unstable_cache(
  async (userId: string, resultId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return getSingleResult(store, user, resultId);
  },
  ["rl:single-result"],
  { revalidate: 60, tags: ["test-results"] },
);

export const listTasksForRender = unstable_cache(
  async (userId: string) => {
    if (isUserPostgresConfigured()) {
      try {
        const tasks = await dbGetTasks(userId);
        return tasks.map(serializeTask);
      } catch (error) {
        console.error(
          "[render-loaders] DB task preload failed, falling back to in-memory seed",
          error instanceof Error ? error.message : error,
        );
      }
    }

    const store = await readStoreAsync();
    return store.tasks
      .filter((task) => task.userId === userId)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .map(serializeTask);
  },
  ["rl:tasks"],
  { revalidate: 30, tags: ["tasks"] },
);

export const getPointsSummaryForRender = unstable_cache(
  async (userId: string) => {
    const { store } = await requireStoredUser(userId);
    return buildPointsSummary(store, userId);
  },
  ["rl:points-summary"],
  { revalidate: 30, tags: ["points"] },
);

export const getProfileStatsForRender = unstable_cache(
  async (userId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return buildUserStatsSnapshot(store, user);
  },
  ["rl:profile-stats"],
  { revalidate: 30, tags: ["profile"] },
);

export const getChallengeOfTheDayForRender = unstable_cache(
  async (userId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return getChallengeOfTheDay(store, user);
  },
  ["rl:challenge-of-day"],
  // Challenge is the same all day — 5-minute TTL is plenty
  { revalidate: 300, tags: ["challenge"] },
);

export const listGeneratedDppsForRender = unstable_cache(
  async (userId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return listGeneratedDpps(store, user);
  },
  ["rl:generated-dpps"],
  { revalidate: 30, tags: ["dpps"] },
);

export type GeneratedDppForRender = Awaited<ReturnType<typeof listGeneratedDppsForRender>>[number];

export const listOgcodeQuestionsForRender = unstable_cache(
  async (
    userId: string,
    filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
  ) => {
    const { store, user } = await requireStoredUser(userId);
    return listOgcodeQuestions(store, user, filters);
  },
  ["rl:ogcode-questions"],
  { revalidate: 30, tags: ["ogcode"] },
);

export const listOgcodeQuestionPageForRender = unstable_cache(
  async (userId: string, filters: OgcodeQuestionListFilters) => {
    const { store, user } = await requireStoredUser(userId);
    return listOgcodeQuestionPage(store, user, filters);
  },
  ["rl:ogcode-question-page"],
  { revalidate: 30, tags: ["ogcode"] },
);

export const getOgcodeIndexDataForRender = unstable_cache(
  async (userId: string, filters: OgcodeQuestionListFilters) => {
    const { store, user } = await requireStoredUser(userId);
    return getOgcodeIndexData(store, user, filters);
  },
  ["rl:ogcode-index"],
  { revalidate: 30, tags: ["ogcode"] },
);

export const getPracticeQuestionDetailForRender = unstable_cache(
  async (userId: string, questionId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return getPracticeQuestionDetail(store, user, questionId);
  },
  ["rl:ogcode-question-detail"],
  { revalidate: 60, tags: ["ogcode"] },
);

export const getOgcodeLeaderboardForRender = unstable_cache(
  async (userId: string, subject: string | null) => {
    const { store, user } = await requireStoredUser(userId);
    return getOgcodeLeaderboard(store, user, subject);
  },
  ["rl:ogcode-leaderboard"],
  { revalidate: 60, tags: ["leaderboard"] },
);

export const getOgcodeUserStatsForRender = unstable_cache(
  async (userId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return getOgcodeUserStats(store, user);
  },
  ["rl:ogcode-user-stats"],
  { revalidate: 30, tags: ["ogcode"] },
);

export const getOgcodeSubjectRanksForRender = unstable_cache(
  async (userId: string) => {
    const { store, user } = await requireStoredUser(userId);
    return getOgcodeSubjectRanks(store, user);
  },
  ["rl:ogcode-subject-ranks"],
  { revalidate: 60, tags: ["ogcode"] },
);

export const listOgcodeQuestionChaptersForRender = unstable_cache(
  async (userId: string, subject: string) => {
    const { store, user } = await requireStoredUser(userId);
    return listOgcodeQuestionChapters(store, user, subject);
  },
  ["rl:ogcode-chapters"],
  { revalidate: 300, tags: ["ogcode"] },
);
