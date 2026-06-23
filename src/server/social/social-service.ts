/**
 * Student Social service — public profiles, the follow graph, and student search.
 *
 * Reuses the fully-hydrated app store (readStoreAsync loads every user's rows
 * from Postgres and caches them) so a target student's rank, badges, Activity
 * Vault and recent activity are computed with the SAME functions that power the
 * owner's own /profile — keeping the two views consistent:
 *   - rank + badges + accuracy → buildUserStatsSnapshot
 *   - Activity Vault          → buildContributionData
 *   - streak                  → getOrCreateStreak
 * The follow edges live in social.follows (USER db).
 */

import { readStoreAsync } from "@/server/store";
import type { AppStore, StoredUser } from "@/server/store";
import { buildUserStatsSnapshot, type UserStatsSnapshot } from "@/server/users";
import { buildContributionData, getOrCreateStreak } from "@/server/gamification";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureSocialSchema } from "@/server/social/social-schema";

export type SocialUserCard = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  isMe: boolean;
  isFollowedByMe: boolean;
  followsMe: boolean;
};

export type RecentActivityItem = {
  kind: "practice" | "test";
  subject: string | null;
  count: number;
  label: string;
  at: string;
};

export type PublicProfileStats = {
  globalRank: number | null;
  testsTaken: number;
  studyHours: number;
  overallAccuracy: number;
  totalSolved: number;
  currentStreak: number;
  longestStreak: number;
  subjectProgress: Array<{ subject: string; accuracy: number }>;
  achievements: UserStatsSnapshot["achievements"];
  contributionData: Array<{ date: string; count: number }>;
  recentActivity: RecentActivityItem[];
};

export type PublicProfile = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  joinedAt: string;
  location: string | null;
  isPrivate: boolean;
  isMe: boolean;
  isFollowedByMe: boolean;
  followsMe: boolean;
  followerCount: number;
  followingCount: number;
  /** False when the profile is private and the viewer is not the owner. */
  visible: boolean;
  stats: PublicProfileStats | null;
};

function pool() {
  return getUserPostgresPool();
}

function resolveByUsername(store: AppStore, username: string): StoredUser | null {
  const target = username.trim().toLowerCase();
  if (!target) return null;
  return (
    store.users.find(
      (u) => u.role === "student" && (u.username ?? "").toLowerCase() === target,
    ) ?? null
  );
}

async function followExists(followerId: string, followingId: string): Promise<boolean> {
  const p = pool();
  if (!p) return false;
  const result = await p.query(
    "SELECT 1 FROM social.follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1",
    [followerId, followingId],
  );
  return result.rowCount! > 0;
}

async function followState(
  viewerId: string,
  targetId: string,
): Promise<{ isFollowedByMe: boolean; followsMe: boolean }> {
  const p = pool();
  if (!p || viewerId === targetId) return { isFollowedByMe: false, followsMe: false };
  const result = await p.query(
    `SELECT follower_id, following_id FROM social.follows
       WHERE (follower_id = $1 AND following_id = $2)
          OR (follower_id = $2 AND following_id = $1)`,
    [viewerId, targetId],
  );
  let isFollowedByMe = false;
  let followsMe = false;
  for (const row of result.rows) {
    if (row.follower_id === viewerId) isFollowedByMe = true;
    if (row.follower_id === targetId) followsMe = true;
  }
  return { isFollowedByMe, followsMe };
}

export async function getFollowCounts(
  userId: string,
): Promise<{ followerCount: number; followingCount: number }> {
  const p = pool();
  if (!p) return { followerCount: 0, followingCount: 0 };
  const result = await p.query(
    `SELECT
       (SELECT COUNT(*) FROM social.follows WHERE following_id = $1) AS followers,
       (SELECT COUNT(*) FROM social.follows WHERE follower_id = $1)  AS following`,
    [userId],
  );
  const row = result.rows[0] ?? {};
  return {
    followerCount: Number(row.followers ?? 0),
    followingCount: Number(row.following ?? 0),
  };
}

function isoDateOnly(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

/**
 * Subject-level recent activity. Aggregates the user's recently-solved practice
 * attempts by (day, subject) and recent test results — no exact question content.
 */
function getRecentActivity(store: AppStore, userId: string, limit = 8): RecentActivityItem[] {
  const questionSubject = new Map<string, string>();
  for (const q of store.questions) questionSubject.set(q.id, q.subject);

  // Group solved practice attempts by day + subject.
  const groups = new Map<string, { subject: string; count: number; at: string }>();
  for (const attempt of store.practiceAttempts) {
    if (attempt.userId !== userId || !attempt.isCorrect) continue;
    const subject = questionSubject.get(attempt.questionId) ?? "Practice";
    const day = isoDateOnly(attempt.createdAt);
    const key = `${day}:${subject.toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (attempt.createdAt > existing.at) existing.at = attempt.createdAt;
    } else {
      groups.set(key, { subject, count: 1, at: attempt.createdAt });
    }
  }

  const practiceItems: RecentActivityItem[] = [...groups.values()].map((g) => {
    const pretty = g.subject.charAt(0).toUpperCase() + g.subject.slice(1);
    return {
      kind: "practice",
      subject: pretty,
      count: g.count,
      label: `Solved ${g.count} ${pretty} ${g.count === 1 ? "problem" : "problems"}`,
      at: g.at,
    };
  });

  const testItems: RecentActivityItem[] = store.testResults
    .filter((r) => r.userId === userId)
    .map((r) => ({
      kind: "test" as const,
      subject: null,
      count: r.correctAnswers ?? 0,
      label: `Scored ${Math.round(r.percentage)}% on a test`,
      at: r.createdAt,
    }));

  return [...practiceItems, ...testItems]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

function buildStats(store: AppStore, user: StoredUser): PublicProfileStats {
  const snapshot = buildUserStatsSnapshot(store, user);
  const streak = getOrCreateStreak(store, user.id);
  const contributionData = buildContributionData(store, user.id);
  const totalSolved = contributionData.reduce((sum, entry) => sum + entry.count, 0);
  return {
    globalRank: snapshot.global_rank,
    testsTaken: snapshot.tests_taken,
    studyHours: snapshot.study_hours,
    overallAccuracy: snapshot.overall_accuracy,
    totalSolved,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    subjectProgress: snapshot.subject_progress,
    achievements: snapshot.achievements,
    contributionData,
    recentActivity: getRecentActivity(store, user.id),
  };
}

/**
 * Public profile snapshot for `username`, viewed by `viewerId`. Returns null if
 * no student owns that handle (route should 404). Private profiles return the
 * card with `visible: false` and `stats: null` unless the viewer is the owner.
 */
export async function getPublicProfile(
  viewerId: string,
  username: string,
): Promise<PublicProfile | null> {
  await ensureSocialSchema();
  const store = await readStoreAsync();
  const target = resolveByUsername(store, username);
  if (!target || !target.username) return null;

  const isMe = viewerId === target.id;
  const [{ isFollowedByMe, followsMe }, counts] = await Promise.all([
    followState(viewerId, target.id),
    getFollowCounts(target.id),
  ]);

  const visible = !target.profilePrivate || isMe;

  return {
    id: target.id,
    username: target.username,
    name: target.name,
    avatar: target.avatar,
    joinedAt: target.joinedAt,
    location: target.location,
    isPrivate: Boolean(target.profilePrivate),
    isMe,
    isFollowedByMe,
    followsMe,
    followerCount: counts.followerCount,
    followingCount: counts.followingCount,
    visible,
    stats: visible ? buildStats(store, target) : null,
  };
}

// ─── Phase 2: follow / unfollow / lists / search (wired in the next phase) ─────
export { resolveByUsername, followExists, followState };
