import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { metric } from "@/lib/metrics";
import { getRateLimitMode, isLockdown, rateLimitDivisor, type RateLimitMode } from "@/server/incidents";

type AppRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

type AppRateLimiter = {
  limit(identifier: string): Promise<AppRateLimitResult>;
};

type SlidingWindowDuration = Parameters<typeof Ratelimit.slidingWindow>[1];

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

let hasWarnedMissingRedis = false;

function isHostedProduction(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    Boolean(process.env.FLY_APP_NAME) ||
    process.env.ORIGIN_DEPLOYMENT_ENV === "production"
  );
}

function createNoopLimiter(limit: number): AppRateLimiter {
  if (isHostedProduction() && !hasWarnedMissingRedis) {
    hasWarnedMissingRedis = true;
    const message = "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are not set. Using degraded no-op limiter.";
    console.error(message);
    metric("origin.rate_limit.degraded", { reason: "missing_redis" });
  }

  return {
    async limit() {
      return {
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 60_000,
      };
    },
  };
}

function createLimiter(
  limit: number,
  prefix: string,
  window: SlidingWindowDuration = "60 s",
): AppRateLimiter {
  if (!redis) {
    return createNoopLimiter(limit);
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  });
}

export const authLimiter = createLimiter(5, "rl:auth");

export const aiLimiter = createLimiter(10, "rl:ai");

export const voiceLimiter = createLimiter(5, "rl:voice");

export const submitLimiter = createLimiter(20, "rl:submit");

export const generalLimiter = createLimiter(60, "rl:general");

/** Catch-all limiter for teacher/admin/enrollment mutation endpoints
 * applied in middleware. Per-route limiters (auth, ai, voice, submit,
 * room*) take precedence — this is the floor that catches everything
 * else. Tunable via ORIGIN_MUTATION_RATE_LIMIT (default 60/min). */
const mutationCap = (() => {
  const raw = process.env.ORIGIN_MUTATION_RATE_LIMIT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
})();
export const mutationLimiter = createLimiter(mutationCap, "rl:mut");

export const roomCreateLimiter = createLimiter(10, "rl:room-create", "1 h");

export const roomCodeLimiter = createLimiter(6, "rl:room-code", "1 h");

export const roomJoinLimiter = createLimiter(30, "rl:room-join", "1 h");

export const roomChatLimiter = createLimiter(10, "rl:room-chat", "60 s");

export async function checkRateLimit(
  limiter: AppRateLimiter,
  identifier: string,
  options?: { honorIncidentMode?: boolean },
): Promise<Response | null> {
  let mode: RateLimitMode = "normal";
  if (options?.honorIncidentMode !== false) {
    try {
      mode = await getRateLimitMode();
    } catch (error) {
      console.error("[rate-limit] failed to read incident mode; defaulting to 'normal'", error);
    }
    if (isLockdown(mode)) {
      return new Response(
        JSON.stringify({
          error: "Mutations are temporarily disabled by an active incident.",
          mode,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            "X-RateLimit-Mode": mode,
          },
        },
      );
    }
  }

  let result: AppRateLimitResult;
  try {
    result = await limiter.limit(identifier);
  } catch (error) {
    console.error("[rate-limit] limiter backend failed; allowing request in degraded mode", error);
    metric("origin.rate_limit.degraded", { reason: "backend_error" });
    return null;
  }

  const { success, limit, remaining, reset } = result;
  // Apply incident-mode divisor on top of the raw success — relaxed
  // doubles the budget, strict halves it. Implementation: convert to a
  // virtual "effective remaining" against an effective cap.
  const divisor = rateLimitDivisor(mode);
  const effectiveLimit = divisor === 1 ? limit : Math.max(1, Math.floor(limit / divisor));
  const used = limit - remaining;
  const effectiveRemaining = Math.max(0, effectiveLimit - used);
  const effectiveSuccess = success && effectiveRemaining > 0;

  if (!effectiveSuccess) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(effectiveLimit),
          "X-RateLimit-Remaining": String(effectiveRemaining),
          "X-RateLimit-Reset": String(reset),
          "X-RateLimit-Mode": mode,
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }
  return null;
}
