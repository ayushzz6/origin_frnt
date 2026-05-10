import { Pool } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

declare global {
  var __originUserPool: Pool | undefined;
  var __originUserPoolConnectionString: string | undefined;
}

function getConnectionString(): string | null {
  return process.env.USER_DATABASE_URL ?? null;
}

function shouldUseSsl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
    if (sslMode) return sslMode !== "disable";
    return !LOCAL_HOSTS.has(url.hostname);
  } catch {
    return !connectionString.includes("localhost");
  }
}

export function isUserPostgresConfigured(): boolean {
  return Boolean(getConnectionString());
}

export function getUserPostgresPool(): Pool | null {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

  if (!globalThis.__originUserPool || globalThis.__originUserPoolConnectionString !== connectionString) {
    void globalThis.__originUserPool?.end().catch(() => undefined);
    globalThis.__originUserPool = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
      max: 5,
    });
    globalThis.__originUserPoolConnectionString = connectionString;
  }

  return globalThis.__originUserPool;
}
