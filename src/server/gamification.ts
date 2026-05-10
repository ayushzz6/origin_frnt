import type {
  AppStore,
  StoredDailyActivity,
  StoredPointLog,
  StoredStreakData,
  StoredUser,
  StoredUserScore,
} from "@/server/store";
import { createId } from "@/server/store";

export const RANK_TIERS: Array<[number, string]> = [
  [0, "Novice"],
  [50, "Beginner"],
  [150, "Apprentice"],
  [300, "Intermediate"],
  [600, "Advanced"],
  [1200, "Expert"],
  [2500, "Master"],
  [5000, "Grandmaster"],
  [10000, "Legend"],
];

export const DIFFICULTY_POINTS: Record<string, number> = {
  easy: 10,
  medium: 25,
  hard: 50,
  insane: 100,
};

export type TimedPracticeScore = {
  basePoints: number;
  maxPoints: number;
  pointsAwarded: number;
  resultScore: number;
  targetTimeSeconds: number;
  timeSpentSeconds: number;
  speedMultiplier: number;
  speedBand: "blazing" | "fast" | "steady" | "deliberate" | "slow";
};

const PRACTICE_TARGET_SECONDS: Record<string, number> = {
  easy: 45,
  medium: 90,
  hard: 180,
  insane: 300,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getPracticeSpeedMultiplier(timeRatio: number): number {
  if (timeRatio <= 0.5) {
    return 1.35;
  }
  if (timeRatio <= 1) {
    return 1.35 - ((timeRatio - 0.5) / 0.5) * 0.35;
  }
  if (timeRatio <= 1.75) {
    return 1 - ((timeRatio - 1) / 0.75) * 0.3;
  }
  return 0.55;
}

function getPracticeSpeedBand(timeRatio: number): TimedPracticeScore["speedBand"] {
  if (timeRatio <= 0.5) {
    return "blazing";
  }
  if (timeRatio <= 0.85) {
    return "fast";
  }
  if (timeRatio <= 1.2) {
    return "steady";
  }
  if (timeRatio <= 1.75) {
    return "deliberate";
  }
  return "slow";
}

export function calculateTimedPracticeScore(
  difficulty: string,
  timeSpentSeconds: number,
  options: { isCorrect: boolean; alreadySolved?: boolean } = { isCorrect: false },
): TimedPracticeScore {
  const basePoints = DIFFICULTY_POINTS[difficulty] ?? DIFFICULTY_POINTS.medium;
  const targetTimeSeconds = PRACTICE_TARGET_SECONDS[difficulty] ?? PRACTICE_TARGET_SECONDS.medium;
  const safeTimeSpentSeconds = Math.max(1, Math.round(timeSpentSeconds || targetTimeSeconds));
  const timeRatio = safeTimeSpentSeconds / targetTimeSeconds;
  const speedMultiplier = Number(clamp(getPracticeSpeedMultiplier(timeRatio), 0.55, 1.35).toFixed(3));
  const speedBand = getPracticeSpeedBand(timeRatio);
  const maxPoints = Math.round(basePoints * 1.35) + 5;

  const resultScore = options.isCorrect
    ? Math.max(5, Math.round(basePoints * speedMultiplier) + 5)
    : 0;
  const pointsAwarded = options.isCorrect && !options.alreadySolved ? resultScore : 0;

  return {
    basePoints,
    maxPoints,
    pointsAwarded,
    resultScore,
    targetTimeSeconds,
    timeSpentSeconds: safeTimeSpentSeconds,
    speedMultiplier,
    speedBand,
  };
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastSevenDays(today: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const target = new Date(today);
    target.setDate(today.getDate() - (6 - index));
    return target.toISOString().slice(0, 10);
  });
}

export function getTierForPoints(points: number): string {
  let tier = RANK_TIERS[0][1];
  for (const [minimumPoints, label] of RANK_TIERS) {
    if (points >= minimumPoints) {
      tier = label;
    } else {
      break;
    }
  }
  return tier;
}

export function getOrCreateUserScore(store: AppStore, userId: string): StoredUserScore {
  let score = store.userScores.find((entry) => entry.userId === userId);
  if (!score) {
    score = {
      userId,
      totalPoints: 0,
      currentTier: getTierForPoints(0),
      lastUpdated: new Date().toISOString(),
    };
    store.userScores.push(score);
  }
  return score;
}

export function getOrCreateStreak(store: AppStore, userId: string): StoredStreakData {
  let streak = store.streaks.find((entry) => entry.userId === userId);
  if (!streak) {
    streak = {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
      weeklyData: [false, false, false, false, false, false, false],
    };
    store.streaks.push(streak);
  }
  return streak;
}

export function getOrCreateDailyActivity(store: AppStore, userId: string, date = todayString()): StoredDailyActivity {
  let activity = store.dailyActivities.find((entry) => entry.userId === userId && entry.date === date);
  if (!activity) {
    activity = {
      userId,
      date,
      questionsPracticed: 0,
      webpageTime: 0,
      practiceTime: 0,
      pomodoroTime: 0,
    };
    store.dailyActivities.push(activity);
  }
  return activity;
}

export function updateWeeklyData(store: AppStore, userId: string): void {
  const streak = getOrCreateStreak(store, userId);
  const today = new Date();
  const dateWindow = lastSevenDays(today);
  const activeDates = new Set(
    store.dailyActivities
      .filter((entry) => entry.userId === userId && dateWindow.includes(entry.date))
      .map((entry) => entry.date),
  );
  streak.weeklyData = dateWindow.map((date) => activeDates.has(date));
}

export function updateUserStreak(store: AppStore, userId: string): number {
  const streak = getOrCreateStreak(store, userId);
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    return 0;
  }

  const today = todayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toISOString().slice(0, 10);

  if (streak.lastStudyDate === today) {
    updateWeeklyData(store, userId);
    return streak.currentStreak;
  }

  if (streak.lastStudyDate === yesterdayString) {
    streak.currentStreak += 1;
  } else {
    streak.currentStreak = 1;
  }

  streak.lastStudyDate = today;
  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
  }

  updateWeeklyData(store, userId);
  user.streak = streak.currentStreak;
  return streak.currentStreak;
}

export function awardPoints(
  store: AppStore,
  userId: string,
  points: number,
  activityType: string,
  description: string,
  referenceId: string | null = null,
): StoredPointLog | null {
  if (points <= 0) {
    return null;
  }

  const score = getOrCreateUserScore(store, userId);
  score.totalPoints += points;
  score.currentTier = getTierForPoints(score.totalPoints);
  score.lastUpdated = new Date().toISOString();

  const log: StoredPointLog = {
    id: createId("point_log"),
    userId,
    points,
    activityType,
    description,
    timestamp: new Date().toISOString(),
    referenceId,
  };
  store.pointLogs.unshift(log);
  return log;
}

export function recordTime(
  store: AppStore,
  userId: string,
  timeType: "webpage" | "practice" | "pomodoro",
  timeSpent: number,
  subject?: string | null,
): { createdToday: boolean; recordedSeconds: number } {
  const date = todayString();
  const existed = store.dailyActivities.some((entry) => entry.userId === userId && entry.date === date);
  const activity = getOrCreateDailyActivity(store, userId, date);

  if (!existed) {
    awardPoints(store, userId, 5, "consistency", "Daily consistency reward", date);
    updateUserStreak(store, userId);
  }

  if (timeType === "webpage") {
    activity.webpageTime += timeSpent;
  } else if (timeType === "practice") {
    activity.practiceTime += timeSpent;
  } else {
    activity.pomodoroTime += timeSpent;
  }

  if (subject) {
    const normalizedSubject = subject.trim();
    const existing = store.dailySubjectActivities.find(
      (entry) => entry.userId === userId && entry.date === date && entry.subject === normalizedSubject,
    );
    if (existing) {
      existing.timeSpent += timeSpent;
    } else {
      store.dailySubjectActivities.push({
        userId,
        date,
        subject: normalizedSubject,
        timeSpent,
      });
    }
  }

  return {
    createdToday: !existed,
    recordedSeconds: timeSpent,
  };
}

export function buildPointsSummary(store: AppStore, userId: string) {
  const score = getOrCreateUserScore(store, userId);
  const currentTierIndex = Math.max(
    0,
    RANK_TIERS.findIndex(([, label]) => label === score.currentTier),
  );
  const nextTier = RANK_TIERS[currentTierIndex + 1];
  const recentLogs = store.pointLogs
    .filter((entry) => entry.userId === userId)
    .slice(0, 10)
    .map((entry) => ({
      points: entry.points,
      type: entry.activityType,
      description: entry.description,
      timestamp: entry.timestamp,
    }));

  return {
    totalPoints: score.totalPoints,
    total_points: score.totalPoints,
    currentTier: score.currentTier,
    current_tier: score.currentTier,
    nextTier: nextTier?.[1] ?? "Legend",
    next_tier: nextTier?.[1] ?? "Legend",
    pointsToNext: nextTier ? Math.max(0, nextTier[0] - score.totalPoints) : 0,
    points_to_next: nextTier ? Math.max(0, nextTier[0] - score.totalPoints) : 0,
    progressPercent: nextTier ? Math.min(100, (score.totalPoints / nextTier[0]) * 100) : 100,
    progress_percent: nextTier ? Math.min(100, (score.totalPoints / nextTier[0]) * 100) : 100,
    recentLogs: recentLogs,
    recent_logs: recentLogs,
  };
}

export function buildTimeAnalytics(store: AppStore, userId: string) {
  const today = new Date();
  const dates = lastSevenDays(today);
  return dates.map((date) => {
    const activity = store.dailyActivities.find((entry) => entry.userId === userId && entry.date === date);
    const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
    return {
      date,
      dayName,
      webpageTime: activity?.webpageTime ?? 0,
      practiceTime: activity?.practiceTime ?? 0,
      pomodoroTime: activity?.pomodoroTime ?? 0,
    };
  });
}

export function buildContributionData(store: AppStore, userId: string) {
  return store.dailyActivities
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((entry) => ({
      date: entry.date,
      count: entry.questionsPracticed,
    }));
}

export function updateUserStudyTime(user: StoredUser, seconds: number): void {
  user.totalStudyTime += Math.floor(seconds / 60);
}
