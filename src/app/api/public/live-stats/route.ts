import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    })
  : null;

// Fallback when Redis isn't available (dev without .env)
const FALLBACK = { activeNow: 1240, doubtsToday: 8430, streaksActive: 3210 };

const JITTER = 3;
function jitter(base: number) {
  return base + Math.floor((Math.random() - 0.5) * 2 * JITTER);
}

export async function GET() {
  try {
    if (!redis) {
      return NextResponse.json(
        { activeNow: jitter(FALLBACK.activeNow), doubtsToday: FALLBACK.doubtsToday, streaksActive: FALLBACK.streaksActive },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // presence:active is a sorted set of user IDs with timestamp scores
    // doubts:today:count is a simple counter incremented by origin-ai
    // streaks:active:count is updated by the streak job
    const [presenceCount, doubtsRaw, streaksRaw] = await Promise.all([
      redis.zcount('presence:active', Date.now() - 5 * 60 * 1000, '+inf').catch(() => null),
      redis.get<number>('doubts:today:count').catch(() => null),
      redis.get<number>('streaks:active:count').catch(() => null),
    ]);

    const activeNow = presenceCount != null ? Math.round((presenceCount as number) / 10) * 10 : FALLBACK.activeNow;
    const doubtsToday = doubtsRaw != null ? (doubtsRaw as number) : FALLBACK.doubtsToday;
    const streaksActive = streaksRaw != null ? (streaksRaw as number) : FALLBACK.streaksActive;

    return NextResponse.json(
      { activeNow: jitter(activeNow), doubtsToday, streaksActive },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(FALLBACK, { headers: { 'Cache-Control': 'no-store' } });
  }
}
