// Legacy user implementation kept behind the public server/users barrel.
import bcrypt from "bcryptjs";
import { requireUserFromRequest, resolveTokenToUser, refreshAccessToken, createAuthSessionAsync, extractRefreshTokenCookie } from "@/server/auth";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { dbLoginUser, dbRegisterUser, dbGetTasks, dbCreateTask, dbUpdateTask, dbDeleteTask, dbFindUserByEmail, dbCreateUser, dbUpdateUser, dbCreateAuthSession, dbGetUserCount } from "@/server/db-users";
import { OAuth2Client } from "google-auth-library";
import {
  awardPoints,
  buildContributionData,
  buildPointsSummary,
  buildTimeAnalytics,
  getOrCreateStreak,
  getOrCreateUserScore,
  recordTime,
  updateUserStreak,
} from "@/server/gamification";
import { badRequest, created, noContent, notFound, ok, unauthorized } from "@/server/http";
import type { AppStore, StoredTask, StoredUser } from "@/server/store";
import { createId, withStoreAsync, withStoredUserDefaults } from "@/server/store";

type UserPayload = Record<string, unknown>;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
}

export function serializeUser(store: AppStore, userId: string) {
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }

  const streak = getOrCreateStreak(store, user.id);
  const score = getOrCreateUserScore(store, user.id);
  const today = todayString();
  const daily = store.dailyActivities.find((entry) => entry.userId === user.id && entry.date === today);
  const streakData = {
    currentStreak: streak.currentStreak,
    current_streak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    longest_streak: streak.longestStreak,
    lastStudyDate: streak.lastStudyDate,
    last_study_date: streak.lastStudyDate,
    weeklyData: streak.weeklyData,
    weekly_data: streak.weeklyData,
  };

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    class: user.studentClass,
    studentClass: user.studentClass,
    student_class: user.studentClass,
    fieldOfInterest: user.fieldOfInterest,
    field_of_interest: user.fieldOfInterest,
    referralSource: user.referralSource,
    referral_source: user.referralSource,
    avatar: user.avatar,
    streak: user.streak,
    totalStudyTime: user.totalStudyTime,
    total_study_time: user.totalStudyTime,
    joinedAt: user.joinedAt,
    joined_at: user.joinedAt,
    isPremium: user.isPremium,
    is_premium: user.isPremium,
    premiumExpiry: user.premiumExpiry,
    premium_expiry: user.premiumExpiry,
    yearsOfExperience: user.yearsOfExperience,
    years_of_experience: user.yearsOfExperience,
    subjects: user.subjects,
    studentCapacity: user.studentCapacity,
    student_capacity: user.studentCapacity,
    isOnboarded: user.isOnboarded,
    is_onboarded: user.isOnboarded,
    selectedCourse: user.selectedCourse,
    selected_course: user.selectedCourse,
    isDropper: user.isDropper,
    is_dropper: user.isDropper,
    streakData: streakData,
    streak_data: streakData,
    dailyQuestionsPracticed: daily?.questionsPracticed ?? 0,
    daily_questions_practiced: daily?.questionsPracticed ?? 0,
    timeAnalytics: buildTimeAnalytics(store, user.id),
    time_analytics: buildTimeAnalytics(store, user.id),
    contributionData: buildContributionData(store, user.id),
    contribution_data: buildContributionData(store, user.id),
    points: score.totalPoints,
    location: user.location,
    voiceMinutesUsedToday: user.voiceMinutesUsedToday,
    voice_minutes_used_today: user.voiceMinutesUsedToday,
    tokensUsedToday: user.tokensUsedToday,
    tokens_used_today: user.tokensUsedToday,
    usageResetAt: user.usageResetAt,
    usage_reset_at: user.usageResetAt,
  };

  return payload;
}

export type UserStatsSnapshot = {
  tests_taken: number;
  study_hours: number;
  global_rank: number | null;
  subject_progress: Array<{ subject: string; accuracy: number }>;
  overall_accuracy: number;
  achievements: {
    first_test: boolean;
    streak_7: boolean;
    streak_30: boolean;
    streak_100: boolean;
    doubt_master: boolean;
    top_100: boolean;
    perfect_score: boolean;
    subject_master: boolean;
    night_owl: boolean;
    early_bird: boolean;
  };
};

export function buildUserStatsSnapshot(store: AppStore, user: StoredUser): UserStatsSnapshot {
  const testsTaken = store.testResults.filter((result) => result.userId === user.id).length;
  const studyHours = Math.round(user.totalStudyTime / 60);
  const streak = getOrCreateStreak(store, user.id);

  const subjectStats: Record<string, { correct: number; total: number }> = {};
  for (const subject of user.subjects) {
    subjectStats[subject.toLowerCase()] = { correct: 0, total: 0 };
  }

  for (const attempt of store.practiceAttempts.filter((entry) => entry.userId === user.id)) {
    const question = store.questions.find((entry) => entry.id === attempt.questionId);
    if (!question) {
      continue;
    }

    const subjectKey = question.subject.toLowerCase();
    if (!subjectStats[subjectKey]) {
      subjectStats[subjectKey] = { correct: 0, total: 0 };
    }

    subjectStats[subjectKey].total += 1;
    if (attempt.isCorrect) {
      subjectStats[subjectKey].correct += 1;
    }
  }

  const subjectProgress = Object.entries(subjectStats).map(([subject, data]) => ({
    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }));

  const userAttempts = store.practiceAttempts.filter((entry) => entry.userId === user.id);
  const overallAccuracy =
    userAttempts.length > 0
      ? Math.round((userAttempts.filter((entry) => entry.isCorrect).length / userAttempts.length) * 100)
      : 0;

  const userSolvedCounts: Record<string, Set<string>> = {};
  for (const attempt of store.practiceAttempts) {
    if (!attempt.isCorrect) {
      continue;
    }

    if (!userSolvedCounts[attempt.userId]) {
      userSolvedCounts[attempt.userId] = new Set();
    }
    userSolvedCounts[attempt.userId].add(attempt.questionId);
  }

  const mySolvedCount = userSolvedCounts[user.id]?.size ?? 0;
  const sortedByRank = Object.entries(userSolvedCounts)
    .map(([userId, questions]) => ({ userId, count: questions.size }))
    .sort((left, right) => right.count - left.count);
  const myRankIndex = sortedByRank.findIndex((entry) => entry.userId === user.id);
  const globalRank = mySolvedCount > 0 ? myRankIndex + 1 : null;

  const doubtCount = store.doubtSessions.filter((session) => session.userId === user.id).length;
  const hasPerfectScore = store.testResults.some(
    (result) => result.userId === user.id && result.percentage >= 100,
  );
  const subjectMaster = Object.values(subjectStats).some((s) => s.total >= 50 && (s.correct / s.total) >= 0.9);
  const nightOwl = false;
  const earlyBird = false;

  return {
    tests_taken: testsTaken,
    study_hours: studyHours,
    global_rank: globalRank,
    subject_progress: subjectProgress,
    overall_accuracy: overallAccuracy,
    achievements: {
      first_test: testsTaken > 0,
      streak_7: streak.longestStreak >= 7 || streak.currentStreak >= 7,
      streak_30: streak.longestStreak >= 30 || streak.currentStreak >= 30,
      streak_100: streak.longestStreak >= 100 || streak.currentStreak >= 100,
      doubt_master: doubtCount >= 50,
      top_100: globalRank !== null && globalRank <= 100,
      perfect_score: hasPerfectScore,
      subject_master: subjectMaster,
      night_owl: nightOwl,
      early_bird: earlyBird,
    },
  };
}

function serializePomodoro(session: {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  mode: string;
  breakReason: string | null;
  interruptionCount: number;
  isCompleted: boolean;
}) {
  return {
    id: session.id,
    startTime: session.startTime,
    start_time: session.startTime,
    endTime: session.endTime,
    end_time: session.endTime,
    duration: session.duration,
    mode: session.mode,
    breakReason: session.breakReason,
    break_reason: session.breakReason,
    interruptionCount: session.interruptionCount,
    interruption_count: session.interruptionCount,
    isCompleted: session.isCompleted,
    is_completed: session.isCompleted,
  };
}

export async function handleLogin(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const password = asString(payload.password);
  const requestedRole = asString(payload.role)?.trim().toLowerCase();
  const role =
    requestedRole === "student" || requestedRole === "teacher" || requestedRole === "admin"
      ? requestedRole
      : null;

  if (!email || !password) {
    return badRequest('Must include "email" and "password".');
  }

  // DB-backed login when Postgres is configured
  if (isUserPostgresConfigured()) {
    try {
      const rolesToTry = role ? [role] : ["student", "teacher"];
      let dbResult = null;
      for (const r of rolesToTry) {
        const res = await dbLoginUser(email, password, r);
        if (res) {
          if (dbResult) {
            return badRequest("Multiple accounts use this email. Please select Student or Teacher before logging in.");
          }
          dbResult = res;
        }
      }
      if (dbResult) {
        return withStoreAsync(async (store) => {
          store.authSessions = store.authSessions.filter((s) => s.userId !== dbResult!.user.id);
          store.authSessions.push(dbResult!.session);
          const userData = serializeUser(store, dbResult!.user.id);
          return ok({ user: userData, refresh: dbResult!.session.refreshToken, access: dbResult!.session.accessToken, accessFingerprint: dbResult!.session.accessFingerprint });
        });
      }
      // No matching DB user — fall through to seeded users.
    } catch (err) {
      console.error('[users] DB login failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const emailMatches = store.users.filter((entry) => entry.email.toLowerCase() === email);
    const matchingUsers = emailMatches.filter((entry) => bcrypt.compareSync(password, entry.password));
    const eligibleUsers = role
      ? matchingUsers.filter((entry) => entry.role === role || entry.role === 'admin')
      : matchingUsers;

    if (!eligibleUsers.length) {
      return badRequest("Invalid email or password.");
    }
    if (!role && eligibleUsers.length > 1) {
      return badRequest("Multiple accounts use this email. Please select Student or Teacher before logging in.");
    }

    const user = eligibleUsers[0];
    const session = await createAuthSessionAsync(store, user.id);
    const userData = serializeUser(store, user.id);
    if (!userData) return notFound("User not found.");

    return ok({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
  });
}

export async function handleLoginWithOtp(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const role = asString(payload.role)?.trim().toLowerCase();

  if (!email) {
    return badRequest('Must include "email".');
  }

  return withStoreAsync(async (store) => {
    // Check if OTP was verified for this email
    const isVerified = store.otps.some(o => o.email.toLowerCase() === email && o.verified === true);
    if (!isVerified) {
      return unauthorized("Email verification required.");
    }

    const user = store.users.find((entry) => entry.email.toLowerCase() === email && (role ? entry.role === role : true));
    if (!user) {
      return notFound("User not found.");
    }

    const session = await createAuthSessionAsync(store, user.id);
    const userData = serializeUser(store, user.id);
    if (!userData) return notFound("User not found.");

    // Clean up OTP after successful login
    store.otps = store.otps.filter(o => o.email.toLowerCase() !== email);

    return ok({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
  });
}

const REGISTRATION_LIMIT = 51;

export async function getRegistrationStatus() {
  if (isUserPostgresConfigured()) {
    try {
      const count = await dbGetUserCount();
      return { count, limit: REGISTRATION_LIMIT, seatsLeft: Math.max(0, REGISTRATION_LIMIT - count) };
    } catch (err) {
      console.error('[users] Failed to get user count', err);
    }
  }

  return withStoreAsync(async (store) => {
    const count = store.users.length;
    return { count, limit: REGISTRATION_LIMIT, seatsLeft: Math.max(0, REGISTRATION_LIMIT - count) };
  });
}

export async function handleRegister(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const password = asString(payload.password);
  const name = asString(payload.name)?.trim() ?? "";
  const role = (asString(payload.role)?.toLowerCase() as "student" | "teacher" | "admin" | undefined) ?? "student";

  if (!email || !password) {
    return badRequest('Must include "email" and "password".');
  }

  // Enforce registration limit
  const status = await getRegistrationStatus();
  if (status.seatsLeft <= 0) {
    return badRequest("Registration is currently closed. We've reached our maximum capacity for this phase.");
  }

  // DB-backed registration when Postgres is configured
  if (isUserPostgresConfigured()) {
    try {
      const { user: dbUser, session } = await dbRegisterUser({ name, email, password, role });
      return withStoreAsync(async (store) => {
        const existing = store.users.find((entry) => entry.id === dbUser.id);
        if (existing) {
          Object.assign(existing, dbUser);
        } else {
          store.users.push({ ...dbUser, password: dbUser.password });
        }
        store.authSessions = store.authSessions.filter((s) => s.userId !== dbUser.id);
        store.authSessions.push(session);
        const userData = serializeUser(store, dbUser.id);
        return created({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        return badRequest(err.message);
      }
      console.error('[users] DB register failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    if (store.users.some((entry) => entry.email.toLowerCase() === email)) {
      return badRequest("A user with this email already exists.");
    }

    const userId = createId("user");
    store.users.push(withStoredUserDefaults({
      id: userId,
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role: role === "teacher" || role === "admin" ? role : "student",
      studentClass: null,
      fieldOfInterest: null,
      referralSource: null,
      avatar: null,
      streak: 0,
      totalStudyTime: 0,
      joinedAt: new Date().toISOString(),
      isPremium: false,
      premiumExpiry: null,
      isOnboarded: false,
      selectedCourse: null,
      isDropper: false,
      yearsOfExperience: null,
      subjects: [],
      studentCapacity: null,
    }));

    const session = await createAuthSessionAsync(store, userId);
    const userData = serializeUser(store, userId);
    if (!userData) {
      return notFound("User not found.");
    }

    return created({
      user: userData,
      refresh: session.refreshToken,
      access: session.accessToken,
      accessFingerprint: session.accessFingerprint,
    });
  });
}

export async function handleGoogleLogin(payload: UserPayload) {
  const credential = asString(payload.credential);
  if (!credential) return badRequest("Missing Google credential token.");

  try {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
    let email: string | undefined;
    let name: string = "Google User";
    let avatar: string | null = null;

    // Try verifying as ID Token first (JWTs usually have 3 parts separated by dots)
    if (credential.includes('.')) {
      try {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: clientId,
        });
        const googlePayload = ticket.getPayload();
        if (googlePayload) {
          email = googlePayload.email;
          name = googlePayload.name ?? "Google User";
          avatar = googlePayload.picture ?? null;
        }
      } catch (e) {
        console.warn("[GoogleAuth] ID Token verification failed, checking if it is an access token instead", e);
      }
    }

    // If ID token verification didn't work (or skipped), try fetching user info with it as an Access Token
    if (!email) {
      try {
        const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${credential}`);
        if (!res.ok) {
          throw new Error(`Google userinfo status: ${res.status}`);
        }
        const data = await res.json();
        email = data.email;
        name = data.name ?? "Google User";
        avatar = data.picture ?? null;
      } catch (e) {
        console.error("[GoogleAuth] Access Token verification failed:", e);
        return unauthorized("Invalid Google Token (Not an ID Token nor a valid Access Token)");
      }
    }

    if (!email) {
      return unauthorized("Could not retrieve email from Google token.");
    }

    if (isUserPostgresConfigured()) {
      try {
        let dbUser = await dbFindUserByEmail(email, "student");
        if (!dbUser) {
          // Enforce registration limit for new users
          const status = await getRegistrationStatus();
          if (status.seatsLeft <= 0) {
            return badRequest("Registration is currently closed. We've reached our maximum capacity for this phase.");
          }

          const hashed = bcrypt.hashSync(createId("rand"), 10);
          dbUser = await dbCreateUser({
            name, email, password: hashed, role: "student",
            studentClass: null, fieldOfInterest: null, referralSource: null,
            avatar, streak: 0, totalStudyTime: 0, joinedAt: new Date().toISOString(),
            isPremium: false, premiumExpiry: null, isOnboarded: false,
            selectedCourse: null, isDropper: false, yearsOfExperience: null,
            subjects: [], studentCapacity: null,
          });
        } else if (!dbUser.avatar && avatar) {
          await dbUpdateUser(dbUser.id, { avatar });
          dbUser.avatar = avatar;
        }

        const session = await dbCreateAuthSession(dbUser.id);

        return withStoreAsync(async (store) => {
          const existing = store.users.find((entry) => entry.id === dbUser!.id);
          if (existing) {
            Object.assign(existing, dbUser!);
          } else {
            store.users.push({ ...dbUser!, password: dbUser!.password });
          }
          store.authSessions = store.authSessions.filter((s) => s.userId !== dbUser!.id);
          store.authSessions.push(session);
          const userData = serializeUser(store, dbUser!.id);
          return ok({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
        });
      } catch (err) {
        console.error('[users] DB google login failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
      }
    }

    return withStoreAsync(async (store) => {
      let user = store.users.find((entry) => entry.email.toLowerCase() === email!.toLowerCase() && entry.role === 'student');
      if (!user) {
        // Enforce registration limit for new users
        const status = await getRegistrationStatus();
        if (status.seatsLeft <= 0) {
          return badRequest("Registration is currently closed. We've reached our maximum capacity for this phase.");
        }

        const userId = createId("user");
        user = withStoredUserDefaults({
          id: userId, name, email: email!, password: bcrypt.hashSync(createId("rand"), 10),
          role: "student", studentClass: null, fieldOfInterest: null,
          referralSource: null, avatar, streak: 0, totalStudyTime: 0,
          joinedAt: new Date().toISOString(), isPremium: false, premiumExpiry: null,
          isOnboarded: false, selectedCourse: null, isDropper: false,
          yearsOfExperience: null, subjects: [], studentCapacity: null,
        });
        store.users.push(user);
      } else if (!user.avatar && avatar) {
        user.avatar = avatar;
      }

      const session = await createAuthSessionAsync(store, user.id);
      const userData = serializeUser(store, user.id);
      return ok({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
    });
  } catch (e: any) {
    console.error("Google Auth processing error:", e);
    return unauthorized("Failed to process Google login");
  }
}

export async function handleRefresh(request: Request | null, payload: UserPayload) {
  const refreshToken = asString(payload.refresh) ?? (request ? extractRefreshTokenCookie(request) : null);
  if (!refreshToken) {
    return badRequest("Refresh token is required.");
  }

  const tokens = await refreshAccessToken(refreshToken);
  if (!tokens) return unauthorized("Token is invalid or expired.");
  return ok({ access: tokens.accessToken, refresh: tokens.refreshToken, accessFingerprint: tokens.accessFingerprint });
}

async function handleMeGet(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const serialized = serializeUser(store, user.id);
    if (!serialized) {
      return notFound("User not found.");
    }
    return ok(serialized);
  });
}

async function handleMePatch(request: Request, payload: UserPayload) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    const updates: Array<[keyof typeof user, unknown]> = [
      ["name", payload.name],
      ["fieldOfInterest", payload.fieldOfInterest ?? payload.field_of_interest],
      ["referralSource", payload.referralSource ?? payload.referral_source],
      ["avatar", payload.avatar],
      ["selectedCourse", payload.selectedCourse ?? payload.selected_course],
      ["yearsOfExperience", payload.yearsOfExperience ?? payload.years_of_experience],
      ["studentCapacity", payload.studentCapacity ?? payload.student_capacity],
      ["location", payload.location],
    ];

    const studentClass = asString(payload.studentClass ?? payload.student_class ?? payload.class);
    if (studentClass !== null) {
      user.studentClass = studentClass;
    }

    const isOnboarded = asBoolean(payload.isOnboarded ?? payload.is_onboarded);
    if (isOnboarded !== null) {
      user.isOnboarded = isOnboarded;
    }

    const isDropper = asBoolean(payload.isDropper ?? payload.is_dropper);
    if (isDropper !== null) {
      user.isDropper = isDropper;
    }

    const subjects = asStringArray(payload.subjects);
    if (subjects) {
      user.subjects = subjects;
    }

    for (const [field, value] of updates) {
      if (typeof value === "string") {
        (user[field] as unknown) = value;
      }
    }

    const serialized = serializeUser(store, user.id);
    if (!serialized) {
      return notFound("User not found.");
    }
    return ok(serialized);
  });
}

async function handlePointsGet(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    return ok(buildPointsSummary(store, user.id));
  });
}

async function handleStatsGet(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    return ok(buildUserStatsSnapshot(store, user));
  });
}

async function handleTimePost(request: Request, payload: UserPayload) {
  try {
    return withStoreAsync(async (store) => {
      const user = await requireUserFromRequest(store, request);
      if (!user) {
        return unauthorized();
      }

      const timeType = asString(payload.time_type ?? payload.timeType);
      const timeSpent = asNumber(payload.time_spent ?? payload.timeSpent);
      const subject = asString(payload.subject);

      if (process.env.NODE_ENV !== "production") {
        console.warn("[TimeTrack] Processing time entry", {
          userId: user.id,
          timeType,
          timeSpent,
          subject,
        });
      }

      if (!timeType || (timeType !== "webpage" && timeType !== "practice" && timeType !== "pomodoro")) {
        return badRequest("Invalid payload", { time_type: "Expected webpage | practice | pomodoro" });
      }
      if (timeSpent === null || timeSpent <= 0) {
        return badRequest("Invalid payload", { time_spent: "Expected positive integer seconds" });
      }

      const result = recordTime(store, user.id, timeType, Math.floor(timeSpent), subject);

      return ok({
        status: "success",
        recorded_seconds: result.recordedSeconds,
        recordedSeconds: result.recordedSeconds,
      });
    });
  } catch (error) {
    console.error("[TimeTrack] Critical Error:", error);
    return badRequest("internal_server_error", { details: String(error) });
  }
}

async function handlePomodoroList(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    const sessions = store.pomodoroSessions
      .filter((entry) => entry.userId === user.id)
      .sort((left, right) => right.startTime.localeCompare(left.startTime))
      .slice(0, 20)
      .map((entry) => serializePomodoro(entry));

    return ok(sessions);
  });
}

async function handlePomodoroCreate(request: Request, payload: UserPayload) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    const modeRaw = asString(payload.mode) ?? "focus";
    const mode = modeRaw === "shortBreak" || modeRaw === "longBreak" ? modeRaw : "focus";
    const duration = Math.max(0, Math.floor(asNumber(payload.duration) ?? 0));
    const isCompleted = asBoolean(payload.is_completed ?? payload.isCompleted) ?? false;
    const breakReason = asString(payload.break_reason ?? payload.breakReason);
    const interruptionCount = Math.max(0, Math.floor(asNumber(payload.interruption_count ?? payload.interruptionCount) ?? 0));

    const session = {
      id: createId("pomodoro"),
      userId: user.id,
      startTime: new Date().toISOString(),
      endTime: isCompleted ? new Date().toISOString() : null,
      duration,
      mode,
      breakReason,
      interruptionCount,
      isCompleted,
    } as const;

    store.pomodoroSessions.push({ ...session });

    if (isCompleted && duration >= 20 * 60) {
      awardPoints(
        store,
        user.id,
        20,
        "pomodoro",
        `Completed ${mode} session (${Math.floor(duration / 60)} mins)`,
        session.id,
      );
      updateUserStreak(store, user.id);
    }

    return created(serializePomodoro(session));
  });
}

async function handlePomodoroDetail(request: Request, sessionId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const session = store.pomodoroSessions.find((entry) => entry.userId === user.id && entry.id === sessionId);
    if (!session) {
      return notFound("Pomodoro session not found.");
    }
    return ok(serializePomodoro(session));
  });
}

async function handlePomodoroUpdate(request: Request, payload: UserPayload, sessionId: string) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const session = store.pomodoroSessions.find((entry) => entry.userId === user.id && entry.id === sessionId);
    if (!session) {
      return notFound("Pomodoro session not found.");
    }

    const wasCompleted = session.isCompleted;
    const modeRaw = asString(payload.mode);
    if (modeRaw === "focus" || modeRaw === "shortBreak" || modeRaw === "longBreak") {
      session.mode = modeRaw;
    }

    const duration = asNumber(payload.duration);
    if (duration !== null) {
      session.duration = Math.max(0, Math.floor(duration));
    }

    const endTime = asString(payload.end_time ?? payload.endTime);
    if (endTime !== null) {
      session.endTime = endTime;
    }

    const breakReason = asString(payload.break_reason ?? payload.breakReason);
    if (breakReason !== null) {
      session.breakReason = breakReason;
    }

    const interruptionCount = asNumber(payload.interruption_count ?? payload.interruptionCount);
    if (interruptionCount !== null) {
      session.interruptionCount = Math.max(0, Math.floor(interruptionCount));
    }

    const completed = asBoolean(payload.is_completed ?? payload.isCompleted);
    if (completed !== null) {
      session.isCompleted = completed;
      if (completed && !session.endTime) {
        session.endTime = new Date().toISOString();
      }
    }

    if (!wasCompleted && session.isCompleted && session.duration >= 20 * 60) {
      awardPoints(
        store,
        user.id,
        20,
        "pomodoro",
        `Completed ${session.mode} session (${Math.floor(session.duration / 60)} mins)`,
        session.id,
      );
      updateUserStreak(store, user.id);
    }

    return ok(serializePomodoro(session));
  });
}

export function serializeTask(task: StoredTask) {
  return {
    id: task.id,
    text: task.text,
    completed: task.completed,
    due: task.due,
    createdAt: task.createdAt,
    category: task.category ?? null,
    priority: task.priority ?? null,
  };
}

async function handleTaskList(request: Request) {
  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const tasks = await dbGetTasks(user.id);
      return ok(tasks.map(serializeTask));
    } catch (err) {
      console.error('[users] DB task list failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const tasks = store.tasks
      .filter((t) => t.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok(tasks.map(serializeTask));
  });
}

async function handleTaskCreate(request: Request, payload: UserPayload) {
  const text = asString(payload.text)?.trim();
  const due = asString(payload.due);
  if (!text || !due) return badRequest("text and due are required.");

  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const task = await dbCreateTask(user.id, text, due, asString(payload.category) ?? undefined, asString(payload.priority) ?? undefined);
      return created(serializeTask(task));
    } catch (err) {
      console.error('[users] DB task create failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const task: StoredTask = {
      id: createId("task"),
      userId: user.id,
      text,
      completed: false,
      due,
      createdAt: new Date().toISOString(),
      category: asString(payload.category) ?? undefined,
      priority: (asString(payload.priority) as StoredTask['priority']) ?? undefined,
    };
    store.tasks.push(task);
    return created(serializeTask(task));
  });
}

async function handleTaskUpdate(request: Request, payload: UserPayload, taskId: string) {
  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const patch: { completed?: boolean; text?: string; due?: string } = {};
      if (typeof payload.completed === 'boolean') patch.completed = payload.completed;
      if (asString(payload.text)?.trim()) patch.text = asString(payload.text)!.trim();
      if (asString(payload.due)) patch.due = asString(payload.due)!;
      const updated = await dbUpdateTask(taskId, user.id, patch);
      if (!updated) return notFound("Task not found.");
      return ok(serializeTask(updated));
    } catch (err) {
      console.error('[users] DB task update failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const task = store.tasks.find((t) => t.id === taskId && t.userId === user.id);
    if (!task) return notFound("Task not found.");
    if (typeof payload.completed === 'boolean') task.completed = payload.completed;
    if (asString(payload.text)?.trim()) task.text = asString(payload.text)!.trim();
    if (asString(payload.due)) task.due = asString(payload.due)!;
    if (asString(payload.category) !== null) task.category = asString(payload.category) ?? undefined;
    if (asString(payload.priority)) task.priority = asString(payload.priority) as StoredTask['priority'];
    return ok(serializeTask(task));
  });
}

async function handleTaskDelete(request: Request, taskId: string) {
  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const deleted = await dbDeleteTask(taskId, user.id);
      if (!deleted) return notFound("Task not found.");
      return noContent();
    } catch (err) {
      console.error('[users] DB task delete failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const idx = store.tasks.findIndex((t) => t.id === taskId && t.userId === user.id);
    if (idx === -1) return notFound("Task not found.");
    store.tasks.splice(idx, 1);
    return noContent();
  });
}

export async function handleUsersRequest(method: string, slug: string[], request: Request, payload: UserPayload) {
  if (slug.length === 1 && slug[0] === "login" && method === "POST") {
    return handleLogin(payload);
  }
  if (slug.length === 1 && slug[0] === "register" && method === "POST") {
    return handleRegister(payload);
  }
  if (slug.length === 1 && slug[0] === "google-login" && method === "POST") {
    return handleGoogleLogin(payload);
  }
  if (slug.length === 2 && slug[0] === "token" && slug[1] === "refresh" && method === "POST") {
    return handleRefresh(request, payload);
  }
  if (slug.length === 1 && slug[0] === "me" && method === "GET") {
    return handleMeGet(request);
  }
  if (slug.length === 1 && slug[0] === "me" && (method === "PATCH" || method === "PUT")) {
    return handleMePatch(request, payload);
  }
  if (slug.length === 1 && slug[0] === "points" && method === "GET") {
    return handlePointsGet(request);
  }
  if (slug.length === 1 && slug[0] === "stats" && method === "GET") {
    return handleStatsGet(request);
  }
  if (slug.length === 1 && slug[0] === "time" && method === "POST") {
    return handleTimePost(request, payload);
  }
  if (slug.length === 1 && slug[0] === "pomodoro" && method === "GET") {
    return handlePomodoroList(request);
  }
  if (slug.length === 1 && slug[0] === "pomodoro" && method === "POST") {
    return handlePomodoroCreate(request, payload);
  }
  if (slug.length === 2 && slug[0] === "pomodoro" && method === "GET") {
    return handlePomodoroDetail(request, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "pomodoro" && (method === "PATCH" || method === "PUT")) {
    return handlePomodoroUpdate(request, payload, slug[1]);
  }
  if (slug.length === 1 && slug[0] === "tasks" && method === "GET") {
    return handleTaskList(request);
  }
  if (slug.length === 1 && slug[0] === "tasks" && method === "POST") {
    return handleTaskCreate(request, payload);
  }
  if (slug.length === 2 && slug[0] === "tasks" && (method === "PATCH" || method === "PUT")) {
    return handleTaskUpdate(request, payload, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "tasks" && method === "DELETE") {
    return handleTaskDelete(request, slug[1]);
  }

  return notFound("Endpoint not found.");
}
