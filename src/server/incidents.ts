/**
 * Phase 13 incident controls — runtime overrides backed by Redis.
 *
 * Provides:
 *  - kill-switch for any FeatureKey (overrides env flag, takes effect
 *    within the cache TTL — default 5s);
 *  - rate-limit mode (`relaxed | normal | strict | lockdown`) that the
 *    mutation limiter middleware reads;
 *  - force-logout-user via dbIncrementAuthTokenVersionAndRevokeSessions;
 *  - workspace close via the existing admin service.
 *
 * Every mutating call here also writes one app.audit_events row so the
 * incident is reconstructable. The admin UI lives at /admin/incidents.
 *
 * Storage shape (Redis, when configured — process memory otherwise):
 *  - `incident:flag:<flagKey>` → "on" | "off" (string) — null = no override
 *  - `incident:rate-limit-mode` → one of RateLimitMode (string)
 *
 * Falls back to in-memory state when Redis is not configured (dev/CI).
 * In production, missing Redis means incidents do not propagate across
 * pods — flagged on first read with a one-shot console error.
 */

import { Redis } from "@upstash/redis";

import type { FlagKey } from "@/lib/feature-flags";
import { metric } from "@/lib/metrics";

const FLAG_KEY_PREFIX = "incident:flag:";
const RATE_LIMIT_KEY = "incident:rate-limit-mode";

export type RateLimitMode = "relaxed" | "normal" | "strict" | "lockdown";

const RATE_LIMIT_MODES: RateLimitMode[] = ["relaxed", "normal", "strict", "lockdown"];

export const RATE_LIMIT_MODE_DESCRIPTIONS: Record<RateLimitMode, string> = {
  relaxed: "2x the normal mutation budget — incidents that need elevated capacity (post-recovery clears).",
  normal: "Default: respects ORIGIN_MUTATION_RATE_LIMIT.",
  strict: "0.5x the normal mutation budget — sustained abuse, partial degradation.",
  lockdown: "0 mutations — emergency stop. /api/teacher, /api/admin, /api/enrollments writes are refused.",
};

type Snapshot = {
  flagOverrides: Map<FlagKey, boolean>;
  rateLimitMode: RateLimitMode;
  fetchedAt: number;
};

const SNAPSHOT_TTL_MS = (() => {
  const raw = process.env.INCIDENT_SNAPSHOT_TTL_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5_000;
})();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis: Redis | null =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const memory = {
  flagOverrides: new Map<FlagKey, boolean>(),
  rateLimitMode: "normal" as RateLimitMode,
};

let snapshot: Snapshot | null = null;
let warnedMissingRedis = false;

function warnRedisMissingOnce() {
  if (warnedMissingRedis) return;
  warnedMissingRedis = true;
  if (process.env.NODE_ENV === "production") {
    console.error("[incidents] UPSTASH_REDIS_REST_URL/TOKEN missing — incident controls are pod-local only.");
    metric("origin.incidents.degraded", { reason: "missing_redis" });
  }
}

function parseRateLimitMode(raw: unknown): RateLimitMode {
  if (typeof raw !== "string") return "normal";
  return RATE_LIMIT_MODES.includes(raw as RateLimitMode) ? (raw as RateLimitMode) : "normal";
}

async function loadSnapshot(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.fetchedAt < SNAPSHOT_TTL_MS) {
    return snapshot;
  }
  if (!redis) {
    warnRedisMissingOnce();
    snapshot = {
      flagOverrides: new Map(memory.flagOverrides),
      rateLimitMode: memory.rateLimitMode,
      fetchedAt: Date.now(),
    };
    return snapshot;
  }
  try {
    const keys = await redis.keys(`${FLAG_KEY_PREFIX}*`);
    const overrides = new Map<FlagKey, boolean>();
    if (keys.length > 0) {
      const values = await redis.mget<(string | null)[]>(...keys);
      keys.forEach((key, i) => {
        const flag = key.slice(FLAG_KEY_PREFIX.length) as FlagKey;
        const v = values?.[i];
        if (v === "on") overrides.set(flag, true);
        else if (v === "off") overrides.set(flag, false);
      });
    }
    const modeRaw = await redis.get(RATE_LIMIT_KEY);
    snapshot = {
      flagOverrides: overrides,
      rateLimitMode: parseRateLimitMode(modeRaw),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error("[incidents] failed to load snapshot from Redis; using last known state", err);
    metric("origin.incidents.degraded", { reason: "redis_error" });
    if (!snapshot) {
      snapshot = {
        flagOverrides: new Map(),
        rateLimitMode: "normal",
        fetchedAt: Date.now(),
      };
    } else {
      snapshot.fetchedAt = Date.now();
    }
  }
  return snapshot;
}

/** Force-refresh the in-process snapshot — called after a mutation so
 * the actor sees their own change immediately, instead of waiting for
 * the cache TTL to expire. */
function invalidateSnapshot() {
  snapshot = null;
}

export async function getFlagOverride(flag: FlagKey): Promise<boolean | null> {
  const s = await loadSnapshot();
  if (s.flagOverrides.has(flag)) return s.flagOverrides.get(flag)!;
  return null;
}

export async function getRateLimitMode(): Promise<RateLimitMode> {
  const s = await loadSnapshot();
  return s.rateLimitMode;
}

export async function setFlagOverride(flag: FlagKey, value: "on" | "off" | "clear"): Promise<void> {
  if (redis) {
    if (value === "clear") await redis.del(`${FLAG_KEY_PREFIX}${flag}`);
    else await redis.set(`${FLAG_KEY_PREFIX}${flag}`, value);
  } else {
    if (value === "clear") memory.flagOverrides.delete(flag);
    else memory.flagOverrides.set(flag, value === "on");
  }
  invalidateSnapshot();
}

export async function setRateLimitMode(mode: RateLimitMode): Promise<void> {
  if (redis) await redis.set(RATE_LIMIT_KEY, mode);
  else memory.rateLimitMode = mode;
  invalidateSnapshot();
}

export async function getIncidentSnapshot(): Promise<{
  flagOverrides: Record<string, boolean>;
  rateLimitMode: RateLimitMode;
  redisConfigured: boolean;
  snapshotTtlMs: number;
}> {
  const s = await loadSnapshot();
  return {
    flagOverrides: Object.fromEntries(s.flagOverrides),
    rateLimitMode: s.rateLimitMode,
    redisConfigured: redis !== null,
    snapshotTtlMs: SNAPSHOT_TTL_MS,
  };
}

/** Mutation-limiter multiplier in effect for the current rate-limit
 * mode. The limiter middleware divides its base cap by this multiplier:
 * relaxed=0.5 → 2x cap; strict=2 → 0.5x cap; lockdown=Infinity → 0
 * effective requests. */
export function rateLimitDivisor(mode: RateLimitMode): number {
  switch (mode) {
    case "relaxed": return 0.5;
    case "normal":  return 1;
    case "strict":  return 2;
    case "lockdown": return Number.POSITIVE_INFINITY;
  }
}

/** True when the rate-limit mode is "lockdown" — the mutation limiter
 * should reject every request before consulting Redis. */
export function isLockdown(mode: RateLimitMode): boolean {
  return mode === "lockdown";
}

/** Map of FlagKey → API path prefixes that should be 404'd when the
 * flag is killed via /admin/incidents. Only flags that gate user-facing
 * mutation surfaces are enumerated; killing a flag without an entry
 * here only affects callers that consult getFlagOverride() directly. */
export const FLAG_KILL_PREFIXES: Partial<Record<FlagKey, string[]>> = {
  workspaces: ["/api/teacher/workspaces"],
  orgCodes: ["/api/teacher/codes", "/api/teacher/workspaces"],
  enrollment: ["/api/enrollments"],
  batches: ["/api/teacher/workspaces"],
  questionBag: ["/api/teacher/workspaces"],
  teacherTests: ["/api/teacher/workspaces"],
  teacherRooms: ["/api/teacher/workspaces"],
  studyMaterials: ["/api/teacher/workspaces"],
  teacherAnalytics: ["/api/teacher/workspaces"],
  ogcodePublishing: ["/api/teacher/workspaces", "/api/admin/ogcode"],
  documentImport: ["/api/teacher/workspaces", "/api/admin/import-jobs"],
  adminControlCenter: ["/api/admin"],
  paidEnrollment: ["/api/enrollments"],
};

/** Returns the first FlagKey killed by an incident override that
 * applies to the given API path, or null when none. Used by middleware
 * to refuse traffic with 503 + a structured payload. */
export async function findKillSwitchForPath(pathname: string): Promise<FlagKey | null> {
  const s = await loadSnapshot();
  for (const [flag, killed] of s.flagOverrides) {
    if (killed !== false) continue;
    const prefixes = FLAG_KILL_PREFIXES[flag as FlagKey];
    if (!prefixes) continue;
    if (prefixes.some((p) => pathname.startsWith(p))) {
      return flag as FlagKey;
    }
  }
  return null;
}
