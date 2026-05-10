import { Pool } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

declare global {
  var __originOgcodePool: Pool | undefined;
}

function getConnectionString(): string | null {
  return (
    process.env.OGCODE_DATABASE_URL ??
    process.env.OGCODE_POSTGRES_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    null
  );
}

function shouldUseSsl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
    if (sslMode) {
      return sslMode !== "disable";
    }
    return !LOCAL_HOSTS.has(url.hostname);
  } catch {
    return !connectionString.includes("localhost");
  }
}

export function isOgcodePostgresConfigured(): boolean {
  return Boolean(getConnectionString());
}

export function getOgcodePostgresPool(): Pool | null {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return null;
  }

  if (!globalThis.__originOgcodePool) {
    globalThis.__originOgcodePool = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }

  return globalThis.__originOgcodePool;
}
