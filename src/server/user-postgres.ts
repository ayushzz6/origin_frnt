import { Pool } from "pg";

import { createPostgresPoolConfig } from "@/server/postgres-config";

declare global {
  var __originUserPool: Pool | undefined;
  var __originUserPoolConnectionString: string | undefined;
}

function getConnectionString(): string | null {
  return process.env.USER_DATABASE_URL ?? null;
}

export function isUserPostgresConfigured(): boolean {
  return Boolean(getConnectionString());
}

export function getUserPostgresPool(): Pool | null {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

  const poolConfig = createPostgresPoolConfig(connectionString, 25);

  if (!globalThis.__originUserPool || globalThis.__originUserPoolConnectionString !== poolConfig.connectionString) {
    void globalThis.__originUserPool?.end().catch(() => undefined);
    globalThis.__originUserPool = new Pool(poolConfig);
    globalThis.__originUserPoolConnectionString = poolConfig.connectionString;
  }

  return globalThis.__originUserPool;
}
