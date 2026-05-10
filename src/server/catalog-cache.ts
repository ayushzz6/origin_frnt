import type { PoolClient } from "pg";

import { metric } from "@/lib/metrics";
import { getOgcodePostgresPool } from "@/server/postgres";
import { readRequiredServiceToken } from "@/server/service-auth";

declare global {
  var __originCatalogCacheSchemaReady: Promise<void> | undefined;
}

export const ORIGIN_AI_CHAPTER_SUBJECTS = ["math", "phy", "chem", "bio"] as const;
export type OriginAiChapterSubject = (typeof ORIGIN_AI_CHAPTER_SUBJECTS)[number];

type CachedChapters = {
  subject: OriginAiChapterSubject;
  payload: unknown;
  fetchedAt: string;
};

export type RefreshCatalogResult = {
  refreshed: string[];
  failed: Array<{ subject: string; error: string }>;
};

const CATALOG_CACHE_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.chapters_cache (
  subject TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function getPool() {
  return getOgcodePostgresPool();
}

async function ensureCatalogCacheSchema(client?: PoolClient): Promise<boolean> {
  const pool = getPool();
  if (!pool) {
    return false;
  }

  if (client) {
    await client.query(CATALOG_CACHE_SCHEMA_SQL);
    return true;
  }

  if (!globalThis.__originCatalogCacheSchemaReady) {
    globalThis.__originCatalogCacheSchemaReady = pool
      .query(CATALOG_CACHE_SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originCatalogCacheSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originCatalogCacheSchemaReady;
  return true;
}

export function isOriginAiChapterSubject(subject: string | null | undefined): subject is OriginAiChapterSubject {
  return ORIGIN_AI_CHAPTER_SUBJECTS.includes(subject as OriginAiChapterSubject);
}

export async function getCachedChapters(subject: OriginAiChapterSubject): Promise<CachedChapters | null> {
  const pool = getPool();
  if (!pool || !(await ensureCatalogCacheSchema())) {
    return null;
  }

  const result = await pool.query(
    `SELECT subject, payload, fetched_at
       FROM app.chapters_cache
      WHERE subject = $1
      LIMIT 1`,
    [subject],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    subject,
    payload: row.payload,
    fetchedAt: String(row.fetched_at),
  };
}

export async function upsertCachedChapters(subject: OriginAiChapterSubject, payload: unknown): Promise<void> {
  const pool = getPool();
  if (!pool || !(await ensureCatalogCacheSchema())) {
    return;
  }

  await pool.query(
    `INSERT INTO app.chapters_cache (subject, payload, fetched_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (subject) DO UPDATE SET
       payload = EXCLUDED.payload,
       fetched_at = EXCLUDED.fetched_at`,
    [subject, JSON.stringify(payload)],
  );
}

async function fetchChaptersFromOriginAi(subject: OriginAiChapterSubject): Promise<unknown> {
  const serviceUrl = process.env.ORIGIN_AI_SERVICE_URL;
  if (!serviceUrl) {
    throw new Error("ORIGIN_AI_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${serviceUrl}/api/v1/chapters?subject=${encodeURIComponent(subject)}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${readRequiredServiceToken("ORIGIN_AI_SERVICE_TOKEN")}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Origin AI chapter refresh failed with status ${response.status}.`);
  }

  return response.json();
}

export async function refreshChapterCatalog(
  subjects: readonly OriginAiChapterSubject[] = ORIGIN_AI_CHAPTER_SUBJECTS,
): Promise<RefreshCatalogResult> {
  const result: RefreshCatalogResult = {
    refreshed: [],
    failed: [],
  };

  for (const subject of subjects) {
    try {
      const payload = await fetchChaptersFromOriginAi(subject);
      await upsertCachedChapters(subject, payload);
      result.refreshed.push(subject);
      metric("origin.catalog.refresh", { subject, status: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ subject, error: message });
      metric("origin.catalog.refresh", { subject, status: "failed" });
    }
  }

  return result;
}
