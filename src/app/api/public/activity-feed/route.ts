import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    })
  : null;

// Anonymized synthetic pool — always available as fallback
const SYNTHETIC: { emoji: string; text: string }[] = [
  { emoji: '🔥', text: 'Aarav from Kota just hit a 21-day streak' },
  { emoji: '🧠', text: 'Priya solved a 3-star Irodov problem' },
  { emoji: '📈', text: "Rahul's predicted percentile rose to 98.2" },
  { emoji: '⚡', text: '14,203 doubts resolved today' },
  { emoji: '🎯', text: 'Sneha cracked a JEE-level electrostatics problem' },
  { emoji: '🏆', text: 'Arjun topped this week\'s Physics leaderboard' },
  { emoji: '📚', text: '847 students completed their DPP today' },
  { emoji: '⚡', text: 'Origin AI explained thermodynamics in 12 seconds' },
  { emoji: '🔥', text: 'Meera extended her streak to 34 days' },
  { emoji: '📈', text: 'Vikram moved from 87th → 94th percentile this week' },
  { emoji: '🧠', text: '2,341 students are solving right now' },
  { emoji: '🎯', text: 'Divya solved 15 problems in the last 30 minutes' },
  { emoji: '⚡', text: 'New record: 320 doubts solved in one hour' },
  { emoji: '🏆', text: 'Isha just unlocked the Momentum badge' },
  { emoji: '📚', text: 'HC Verma chapter 23 — 412 attempts today' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  try {
    // Try to pull recent real events from Redis (optional stream/list)
    let events: { emoji: string; text: string }[] = [];

    if (redis) {
      const raw = await redis.lrange<string>('activity:feed', 0, 19).catch(() => []);
      if (raw && raw.length > 0) {
        events = raw.map((item) => {
          try {
            return typeof item === 'string' ? JSON.parse(item) : item;
          } catch {
            return null;
          }
        }).filter(Boolean) as { emoji: string; text: string }[];
      }
    }

    // Fill remainder with shuffled synthetic
    const combined = [...events, ...shuffle(SYNTHETIC)].slice(0, 20);

    return NextResponse.json(
      { events: combined },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    );
  } catch {
    return NextResponse.json(
      { events: shuffle(SYNTHETIC) },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    );
  }
}
