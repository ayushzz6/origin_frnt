import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

import { getRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { getOgcodePostgresPool } from "@/server/postgres";
import { getUserPostgresPool } from "@/server/user-postgres";

type ComponentState = "ok" | "down" | "skipped";

type ComponentHealth = {
  status: ComponentState;
  latencyMs?: number;
  detail?: string;
};

const SERVICE_TIMEOUT_MS = 1800;

function isHostedProduction(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    Boolean(process.env.FLY_APP_NAME) ||
    process.env.ORIGIN_DEPLOYMENT_ENV === "production"
  );
}

function serviceHeaders(token?: string | null, requestId?: string): HeadersInit {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = Date.now();
  const value = await fn();
  return { value, latencyMs: Date.now() - started };
}

async function pingService(
  url: string | undefined,
  input: { token?: string | null; requestId: string },
): Promise<ComponentHealth> {
  if (!url) {
    return { status: "skipped", detail: "not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);
  try {
    const result = await timed(async () => {
      const response = await fetch(`${url.replace(/\/+$/, "")}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: serviceHeaders(input.token, input.requestId),
      });
      return response;
    });
    return {
      status: result.value.ok ? "ok" : "down",
      latencyMs: result.latencyMs,
      detail: result.value.ok ? undefined : `http_${result.value.status}`,
    };
  } catch (error) {
    return {
      status: "down",
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function pingPostgres(name: "appPostgres" | "userPostgres"): Promise<ComponentHealth> {
  const pool = name === "appPostgres" ? getOgcodePostgresPool() : getUserPostgresPool();
  if (!pool) {
    return { status: "skipped", detail: "not_configured" };
  }

  try {
    const result = await timed(async () => {
      await pool.query("SELECT 1");
    });
    return { status: "ok", latencyMs: result.latencyMs };
  } catch (error) {
    return {
      status: "down",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function pingRedis(): Promise<ComponentHealth> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return {
      status: isHostedProduction() ? "down" : "skipped",
      detail: "not_configured",
    };
  }

  try {
    const redis = new Redis({ url, token });
    const result = await timed(async () => {
      await redis.ping();
    });
    return { status: "ok", latencyMs: result.latencyMs };
  } catch (error) {
    return {
      status: "down",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  const [grader, analytics, originAi, appPostgres, userPostgres, redis] = await Promise.all([
    pingService(process.env.GRADER_SERVICE_URL, {
      token: process.env.GRADER_SERVICE_TOKEN,
      requestId,
    }),
    pingService(process.env.ANALYTICS_SERVICE_URL, {
      token: process.env.ANALYTICS_SERVICE_TOKEN,
      requestId,
    }),
    pingService(process.env.ORIGIN_AI_SERVICE_URL, {
      token: process.env.ORIGIN_AI_SERVICE_TOKEN,
      requestId,
    }),
    pingPostgres("appPostgres"),
    pingPostgres("userPostgres"),
    pingRedis(),
  ]);

  const services = {
    frontend: { status: "ok" as const },
    grader,
    analytics,
    originAi,
    appPostgres,
    userPostgres,
    redis,
  };
  const isHealthy = Object.values(services).every((entry) => entry.status === "ok" || entry.status === "skipped");

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "down",
      requestId,
      services,
      checkedAt: new Date().toISOString(),
    },
    {
      status: isHealthy ? 200 : 503,
      headers: { [REQUEST_ID_HEADER]: requestId },
    },
  );
}
