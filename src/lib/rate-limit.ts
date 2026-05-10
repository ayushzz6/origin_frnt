import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { metric } from "@/lib/metrics";

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

export const roomCreateLimiter = createLimiter(10, "rl:room-create", "1 h");

export const roomCodeLimiter = createLimiter(6, "rl:room-code", "1 h");

export const roomJoinLimiter = createLimiter(30, "rl:room-join", "1 h");

export const roomChatLimiter = createLimiter(10, "rl:room-chat", "60 s");

export async function checkRateLimit(
  limiter: AppRateLimiter,
  identifier: string
): Promise<Response | null> {
  let result: AppRateLimitResult;
  try {
    result = await limiter.limit(identifier);
  } catch (error) {
    console.error("[rate-limit] limiter backend failed; allowing request in degraded mode", error);
    metric("origin.rate_limit.degraded", { reason: "backend_error" });
    return null;
  }

  const { success, limit, remaining, reset } = result;
  if (!success) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }
  return null;
}
