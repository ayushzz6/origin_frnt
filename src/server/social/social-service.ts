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
import { getUserPostgresPool } from "@/server/user-postgres";
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

export { resolveByUsername, followExists, followState };

// ─── Follow / unfollow / lists / search ───────────────────────────────────────

export class SocialServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const FOLLOW_PAGE_SIZE = 30;
const SEARCH_LIMIT_MAX = 25;

export type FollowMutationResult = {
  following: boolean;
  followerCount: number;
};

export type FollowListResult = {
  items: SocialUserCard[];
  /** True when the target profile is private and the viewer is not the owner. */
  hidden: boolean;
  hasMore: boolean;
};

/** Lightweight DB resolve (no full store hydration) for write/list paths. */
async function resolveStudentByUsername(
  username: string,
): Promise<{ id: string; username: string; profilePrivate: boolean } | null> {
  const p = pool();
  if (!p) return null;
  const result = await p.query(
    `SELECT id, username, profile_private FROM origin_users
       WHERE LOWER(username) = LOWER($1) AND role = 'student' LIMIT 1`,
    [username.trim()],
  );
  const row = result.rows[0];
  return row ? { id: row.id, username: row.username, profilePrivate: Boolean(row.profile_private) } : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCardRow(row: any, viewerId: string): SocialUserCard {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatar: row.avatar ?? null,
    isMe: row.id === viewerId,
    isFollowedByMe: Boolean(row.is_followed_by_me),
    followsMe: Boolean(row.follows_me),
  };
}

export async function followUser(
  followerId: string,
  username: string,
): Promise<FollowMutationResult> {
  await ensureSocialSchema();
  const p = pool();
  if (!p) throw new SocialServiceError(503, "Social features are unavailable.");
  const target = await resolveStudentByUsername(username);
  if (!target) throw new SocialServiceError(404, "Profile not found.");
  if (target.id === followerId) throw new SocialServiceError(400, "You cannot follow yourself.");

  await p.query(
    `INSERT INTO social.follows (follower_id, following_id)
       VALUES ($1, $2) ON CONFLICT (follower_id, following_id) DO NOTHING`,
    [followerId, target.id],
  );
  const counts = await getFollowCounts(target.id);
  return { following: true, followerCount: counts.followerCount };
}

export async function unfollowUser(
  followerId: string,
  username: string,
): Promise<FollowMutationResult> {
  await ensureSocialSchema();
  const p = pool();
  if (!p) throw new SocialServiceError(503, "Social features are unavailable.");
  const target = await resolveStudentByUsername(username);
  if (!target) throw new SocialServiceError(404, "Profile not found.");

  await p.query(
    "DELETE FROM social.follows WHERE follower_id = $1 AND following_id = $2",
    [followerId, target.id],
  );
  const counts = await getFollowCounts(target.id);
  return { following: false, followerCount: counts.followerCount };
}

async function listFollowEdges(
  targetId: string,
  viewerId: string,
  direction: "followers" | "following",
  page: number,
): Promise<{ items: SocialUserCard[]; hasMore: boolean }> {
  const p = pool();
  if (!p) return { items: [], hasMore: false };
  const offset = Math.max(0, page) * FOLLOW_PAGE_SIZE;
  // followers → people whose edge points AT the target (join on follower_id);
  // following → people the target points to (join on following_id).
  const joinCol = direction === "followers" ? "f.follower_id" : "f.following_id";
  const whereCol = direction === "followers" ? "f.following_id" : "f.follower_id";
  const result = await p.query(
    `SELECT u.id, u.username, u.name, u.avatar,
       EXISTS(SELECT 1 FROM social.follows fa WHERE fa.follower_id = $2 AND fa.following_id = u.id) AS is_followed_by_me,
       EXISTS(SELECT 1 FROM social.follows fb WHERE fb.follower_id = u.id AND fb.following_id = $2) AS follows_me
     FROM social.follows f
     JOIN origin_users u ON u.id = ${joinCol}
     WHERE ${whereCol} = $1 AND u.username IS NOT NULL
     ORDER BY f.created_at DESC
     LIMIT $3 OFFSET $4`,
    [targetId, viewerId, FOLLOW_PAGE_SIZE + 1, offset],
  );
  const rows = result.rows;
  const hasMore = rows.length > FOLLOW_PAGE_SIZE;
  return {
    items: rows.slice(0, FOLLOW_PAGE_SIZE).map((row) => mapCardRow(row, viewerId)),
    hasMore,
  };
}

async function listFollowList(
  username: string,
  viewerId: string,
  direction: "followers" | "following",
  page: number,
): Promise<FollowListResult> {
  await ensureSocialSchema();
  const target = await resolveStudentByUsername(username);
  if (!target) throw new SocialServiceError(404, "Profile not found.");
  // Private accounts hide their follow lists from everyone but the owner.
  if (target.profilePrivate && target.id !== viewerId) {
    return { items: [], hidden: true, hasMore: false };
  }
  const { items, hasMore } = await listFollowEdges(target.id, viewerId, direction, page);
  return { items, hidden: false, hasMore };
}

export function listFollowers(username: string, viewerId: string, page = 0): Promise<FollowListResult> {
  return listFollowList(username, viewerId, "followers", page);
}

export function listFollowing(username: string, viewerId: string, page = 0): Promise<FollowListResult> {
  return listFollowList(username, viewerId, "following", page);
}

// ─── Popular students (default /social view) ──────────────────────────────────

export type PopularTab = "followed" | "ranked" | "active";

export type PopularUserCard = SocialUserCard & {
  /** Current daily streak (denormalised on the user row). */
  streak: number;
  /** Practice accuracy 0–100, one decimal. */
  accuracy: number;
  /** Global rank by distinct correctly-solved questions; null when none solved. */
  rank: number | null;
  /** Tests attempted. */
  tests: number;
  /** Total followers. */
  followerCount: number;
  /** Derived exam/class tag (JEE Advanced / NEET / Class 12 …). */
  badge: string | null;
};

export type PopularStudents = {
  followed: PopularUserCard[];
  ranked: PopularUserCard[];
  active: PopularUserCard[];
};

/** Derive the exam/class badge — no single source field, so infer from course. */
function examBadge(u: StoredUser): string | null {
  const src = `${u.selectedCourse ?? ""} ${u.fieldOfInterest ?? ""}`.toLowerCase();
  if (src.includes("neet")) return "NEET";
  if (src.includes("advanced")) return "JEE Advanced";
  if (src.includes("jee") || src.includes("main")) return "JEE Main";
  if (u.isDropper) return "Dropper";
  if (u.studentClass) return `Class ${u.studentClass}`;
  return null;
}

const ACTIVE_WINDOW_MS = 14 * 86_400_000;

/**
 * The three "popular students" leaderboards that power the default /social view.
 * Reads the cached store ONCE and derives all three tabs from single-pass
 * aggregations (calling buildUserStatsSnapshot per-user would recompute global
 * rank across the whole population every time). Two SQL round-trips: follower
 * counts (all), then follow-state for the union of the three sliced lists.
 */
export async function getPopularStudents(
  viewerId: string,
  perTab = 24,
): Promise<PopularStudents> {
  await ensureSocialSchema();
  const store = await readStoreAsync();
  const p = pool();
  const now = Date.now();

  const solved = new Map<string, Set<string>>(); // distinct correct questionIds → rank
  const acc = new Map<string, { correct: number; total: number }>();
  const activity = new Map<string, { recent: number; last: number }>();

  const bumpActivity = (uid: string, ts: string) => {
    const t = Date.parse(ts) || 0;
    const av = activity.get(uid) ?? { recent: 0, last: 0 };
    if (now - t <= ACTIVE_WINDOW_MS) av.recent += 1;
    if (t > av.last) av.last = t;
    activity.set(uid, av);
  };

  for (const a of store.practiceAttempts) {
    const ac = acc.get(a.userId) ?? { correct: 0, total: 0 };
    ac.total += 1;
    if (a.isCorrect) {
      ac.correct += 1;
      let set = solved.get(a.userId);
      if (!set) { set = new Set(); solved.set(a.userId, set); }
      set.add(a.questionId);
    }
    acc.set(a.userId, ac);
    bumpActivity(a.userId, a.createdAt);
  }

  const tests = new Map<string, number>();
  for (const r of store.testResults) {
    tests.set(r.userId, (tests.get(r.userId) ?? 0) + 1);
    bumpActivity(r.userId, r.createdAt);
  }

  // Global rank = distinct correctly-solved questions, desc.
  const rankOf = new Map<string, number>();
  [...solved.entries()]
    .map(([uid, set]) => ({ uid, n: set.size }))
    .sort((a, b) => b.n - a.n)
    .forEach((e, i) => rankOf.set(e.uid, i + 1));

  // Follower counts for everyone (one GROUP BY — the follows table is small).
  const followerCount = new Map<string, number>();
  if (p) {
    const res = await p.query(
      "SELECT following_id, COUNT(*)::int AS c FROM social.follows GROUP BY following_id",
    );
    for (const row of res.rows) followerCount.set(row.following_id, Number(row.c));
  }

  const eligible = store.users.filter(
    (u) => u.role === "student" && u.username && u.id !== viewerId,
  );

  const toCard = (u: StoredUser): PopularUserCard => {
    const ac = acc.get(u.id);
    return {
      id: u.id,
      username: u.username!,
      name: u.name,
      avatar: u.avatar ?? null,
      isMe: false,
      isFollowedByMe: false,
      followsMe: false,
      streak: u.streak ?? 0,
      accuracy: ac && ac.total > 0 ? Math.round((ac.correct / ac.total) * 1000) / 10 : 0,
      rank: rankOf.get(u.id) ?? null,
      tests: tests.get(u.id) ?? 0,
      followerCount: followerCount.get(u.id) ?? 0,
      badge: examBadge(u),
    };
  };

  const cards = eligible.map(toCard);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const RANK_FLOOR = Number.MAX_SAFE_INTEGER;

  const followed = [...cards]
    .sort((a, b) => b.followerCount - a.followerCount || (a.rank ?? RANK_FLOOR) - (b.rank ?? RANK_FLOOR))
    .slice(0, perTab);
  const ranked = [...cards]
    .sort((a, b) => (a.rank ?? RANK_FLOOR) - (b.rank ?? RANK_FLOOR) || b.accuracy - a.accuracy)
    .slice(0, perTab);
  const active = [...cards]
    .sort((a, b) => {
      const aa = activity.get(a.id) ?? { recent: 0, last: 0 };
      const bb = activity.get(b.id) ?? { recent: 0, last: 0 };
      return bb.recent - aa.recent || bb.last - aa.last;
    })
    .slice(0, perTab);

  // Follow-state only for the union of the three sliced lists (one query).
  const unionIds = [...new Set([...followed, ...ranked, ...active].map((c) => c.id))];
  if (p && unionIds.length > 0) {
    const res = await p.query(
      `SELECT follower_id, following_id FROM social.follows
         WHERE (follower_id = $1 AND following_id = ANY($2))
            OR (following_id = $1 AND follower_id = ANY($2))`,
      [viewerId, unionIds],
    );
    for (const row of res.rows) {
      if (row.follower_id === viewerId) {
        const c = byId.get(row.following_id);
        if (c) c.isFollowedByMe = true;
      }
      if (row.following_id === viewerId) {
        const c = byId.get(row.follower_id);
        if (c) c.followsMe = true;
      }
    }
  }

  return { followed, ranked, active };
}

/** Student search by @username or display name, annotated with follow state. */
export async function searchStudents(
  viewerId: string,
  query: string,
  limit = 12,
): Promise<SocialUserCard[]> {
  await ensureSocialSchema();
  const p = pool();
  const q = query.trim().toLowerCase();
  if (!p || q.length < 1) return [];
  const capped = Math.min(Math.max(1, limit), SEARCH_LIMIT_MAX);
  const like = `%${q}%`;
  const result = await p.query(
    `SELECT u.id, u.username, u.name, u.avatar,
       EXISTS(SELECT 1 FROM social.follows fa WHERE fa.follower_id = $1 AND fa.following_id = u.id) AS is_followed_by_me,
       EXISTS(SELECT 1 FROM social.follows fb WHERE fb.follower_id = u.id AND fb.following_id = $1) AS follows_me
     FROM origin_users u
     WHERE u.role = 'student' AND u.id <> $1 AND u.username IS NOT NULL
       AND (LOWER(u.username) LIKE $2 OR LOWER(u.name) LIKE $2)
     ORDER BY (LOWER(u.username) = $3) DESC, LENGTH(u.name) ASC, u.name ASC
     LIMIT $4`,
    [viewerId, like, q, capped],
  );
  return result.rows.map((row) => mapCardRow(row, viewerId));
}
