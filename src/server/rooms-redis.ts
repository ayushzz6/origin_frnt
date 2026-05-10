import { Redis } from "@upstash/redis";

import type { RoomEvent } from "@/lib/study-rooms/events";

type RedisClient = Redis | null;

type StreamEnvelope = {
  id: string;
  event: RoomEvent;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis: RedisClient =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

const localCodes = new Map<string, { value: string; expiresAt: number }>();
const localStreams = new Map<string, StreamEnvelope[]>();
let localStreamSequence = 0;
let warnedLocalFallback = false;

function maybeWarnLocalFallback() {
  if (redis || warnedLocalFallback || process.env.NODE_ENV === "production") {
    return;
  }
  warnedLocalFallback = true;
  console.warn("[study-rooms] UPSTASH_REDIS_REST_URL/TOKEN are not set. Using in-memory room codes and streams in local development.");
}

function requireRedis(): Redis {
  if (!redis) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for study rooms in production.");
  }
  return redis;
}

function canUseLocalFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

function codeKey(code: string) {
  return `room:code:${code}`;
}

function activeCodeKey(roomId: string) {
  return `room:active-code:${roomId}`;
}

function streamKey(roomId: string) {
  return `room:${roomId}:stream`;
}

function setLocal(key: string, value: string, ttlSeconds: number, nx = false): boolean {
  const now = Date.now();
  const current = localCodes.get(key);
  if (current && current.expiresAt <= now) {
    localCodes.delete(key);
  }
  if (nx && localCodes.has(key)) {
    return false;
  }
  localCodes.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return true;
}

function getLocal(key: string): string | null {
  const current = localCodes.get(key);
  if (!current) {
    return null;
  }
  if (current.expiresAt <= Date.now()) {
    localCodes.delete(key);
    return null;
  }
  return current.value;
}

export async function setRoomCodeToken(code: string, jwt: string, roomId: string, ttlSeconds: number): Promise<boolean> {
  if (!redis) {
    if (!canUseLocalFallback()) requireRedis();
    maybeWarnLocalFallback();
    const didSet = setLocal(codeKey(code), jwt, ttlSeconds, true);
    if (didSet) {
      setLocal(activeCodeKey(roomId), code, ttlSeconds);
    }
    return didSet;
  }

  const result = await redis.set(codeKey(code), jwt, { ex: ttlSeconds, nx: true });
  if (result === "OK") {
    await redis.set(activeCodeKey(roomId), code, { ex: ttlSeconds });
    return true;
  }
  return false;
}

export async function getRoomCodeToken(code: string): Promise<string | null> {
  if (!redis) {
    if (!canUseLocalFallback()) requireRedis();
    maybeWarnLocalFallback();
    return getLocal(codeKey(code));
  }
  return await redis.get<string>(codeKey(code));
}

export async function deleteRoomCode(code: string, roomId?: string): Promise<void> {
  if (!redis) {
    localCodes.delete(codeKey(code));
    if (roomId) localCodes.delete(activeCodeKey(roomId));
    return;
  }
  await redis.del(codeKey(code));
  if (roomId) await redis.del(activeCodeKey(roomId));
}

export async function deleteActiveRoomCode(roomId: string): Promise<void> {
  if (!redis) {
    localCodes.delete(activeCodeKey(roomId));
    return;
  }
  await redis.del(activeCodeKey(roomId));
}

export async function getActiveRoomCode(roomId: string): Promise<{ code: string; ttlSeconds: number } | null> {
  if (!redis) {
    if (!canUseLocalFallback()) requireRedis();
    maybeWarnLocalFallback();
    const key = activeCodeKey(roomId);
    const code = getLocal(key);
    const entry = localCodes.get(key);
    if (!code || !entry) return null;
    return { code, ttlSeconds: Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)) };
  }

  const key = activeCodeKey(roomId);
  const [code, ttl] = await Promise.all([redis.get<string>(key), redis.ttl(key)]);
  if (!code || ttl <= 0) {
    return null;
  }
  return { code, ttlSeconds: ttl };
}

export async function deleteRoomStream(roomId: string): Promise<void> {
  if (!redis) {
    localStreams.delete(streamKey(roomId));
    return;
  }
  await redis.del(streamKey(roomId));
}

export async function appendRoomStreamEvent(roomId: string, event: RoomEvent): Promise<string | null> {
  if (!redis) {
    if (!canUseLocalFallback()) requireRedis();
    maybeWarnLocalFallback();
    const key = streamKey(roomId);
    const stream = localStreams.get(key) ?? [];
    const id = `${Date.now()}-${localStreamSequence += 1}`;
    stream.push({ id, event });
    localStreams.set(key, stream.slice(-500));
    return id;
  }

  const client = redis as unknown as {
    xadd: (...args: unknown[]) => Promise<string | null>;
    xtrim?: (...args: unknown[]) => Promise<unknown>;
  };
  const payload = JSON.stringify(event);
  const id = await client.xadd(streamKey(roomId), "*", { type: event.type, payload });
  await client.xtrim?.(streamKey(roomId), "MAXLEN", "~", 500);
  return id;
}

function cursorToNumber(cursor: string): number {
  if (cursor === "$") return Date.now() * 1000;
  const [milliseconds, sequence] = cursor.split("-").map((part) => Number(part));
  return milliseconds * 1000 + (sequence || 0);
}

async function readLocalStream(roomId: string, cursor: string, count: number, blockMs: number, signal?: AbortSignal): Promise<StreamEnvelope[]> {
  maybeWarnLocalFallback();
  const key = streamKey(roomId);
  const deadline = Date.now() + blockMs;
  const cursorValue = cursorToNumber(cursor);

  while (!signal?.aborted) {
    const stream = localStreams.get(key) ?? [];
    const events = stream
      .filter((entry) => cursor === "$" ? false : cursorToNumber(entry.id) > cursorValue)
      .slice(0, count);
    if (events.length > 0 || Date.now() >= deadline) {
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return [];
}

function parseRedisFields(fields: unknown): Record<string, string> {
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    return fields as Record<string, string>;
  }
  if (!Array.isArray(fields)) {
    return {};
  }
  const output: Record<string, string> = {};
  for (let index = 0; index < fields.length; index += 2) {
    output[String(fields[index])] = String(fields[index + 1] ?? "");
  }
  return output;
}

function parseRedisStreamResponse(response: unknown): StreamEnvelope[] {
  if (!Array.isArray(response) || response.length === 0) {
    return [];
  }

  const firstStream = response[0];
  if (!Array.isArray(firstStream)) {
    return [];
  }

  const entries = firstStream[1];
  if (!Array.isArray(entries)) {
    return [];
  }

  const parsed: StreamEnvelope[] = [];
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const [id, fields] = entry;
    const fieldMap = parseRedisFields(fields);
    if (!fieldMap.payload) continue;
    try {
      parsed.push({ id: String(id), event: JSON.parse(fieldMap.payload) as RoomEvent });
    } catch {
      // Ignore malformed stream entries rather than killing the SSE connection.
    }
  }
  return parsed;
}

export async function readRoomStreamEvents(
  roomId: string,
  cursor: string,
  options: { count?: number; blockMs?: number; signal?: AbortSignal } = {},
): Promise<StreamEnvelope[]> {
  const count = options.count ?? 50;
  const blockMs = options.blockMs ?? 20_000;

  if (!redis) {
    if (!canUseLocalFallback()) requireRedis();
    return readLocalStream(roomId, cursor, count, blockMs, options.signal);
  }

  const client = redis as unknown as {
    xread: (...args: unknown[]) => Promise<unknown>;
  };
  const response = await client.xread("COUNT", count, "BLOCK", blockMs, "STREAMS", streamKey(roomId), cursor);
  return parseRedisStreamResponse(response);
}
