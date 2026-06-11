import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// 8 per week = 5 text + 3 voice — matches the client-side weekly quota
const limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(8, '7 d'), prefix: 'rl:demo-solve' })
  : null;

const MAX_QUESTION_LEN = 500;
const MAX_TOKENS = 600;

// Profanity / PII guard (simple keyword list — expand as needed)
const BLOCKED_PATTERNS = [/\b(fuck|shit|porn|nude|kill|hack)\b/i, /\b\d{10,}\b/, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i];

function isBlocked(text: string): boolean {
  return BLOCKED_PATTERNS.some((re) => re.test(text));
}

const FALLBACK_ANSWER = `Here's how to approach this problem:

**Key Concept:** This is a fundamental JEE/NEET question that tests your understanding of core principles.

**Step-by-step solution:**

1. Identify the given quantities and what you need to find
2. Apply the relevant formula or theorem
3. Substitute values carefully with correct units
4. Simplify and verify the answer

**Answer:** Origin AI would solve this step-by-step with full explanations, diagrams, and follow-up insights — just for you.

*Create a free account to get the complete solution with AI that remembers your strengths and weaknesses.*`;

export async function POST(req: NextRequest) {
  // Honeypot — bots fill this field, real users don't
  let body: { question?: string; hp?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (body.hp) {
    // Silently accept but return empty response (don't reveal the trap)
    return NextResponse.json({ answer: '' });
  }

  const question = (body.question ?? '').trim().slice(0, MAX_QUESTION_LEN);
  if (!question || question.length < 10) {
    return NextResponse.json({ error: 'Question too short' }, { status: 400 });
  }
  if (isBlocked(question)) {
    return NextResponse.json({ error: 'Invalid question content' }, { status: 400 });
  }

  // Rate limit by IP: 1 solve per IP per 24h
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous';

  if (limiter) {
    const { success } = await limiter.limit(`ip:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Daily limit reached. Create a free account for unlimited solves.' },
        { status: 429 }
      );
    }
  }

  // Try real origin-ai service
  const serviceUrl = process.env.ORIGIN_AI_SERVICE_URL;
  if (serviceUrl) {
    try {
      const resp = await fetch(`${serviceUrl}/v1/public/demo-solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ORIGIN_AI_SERVICE_TOKEN ?? ''}`,
        },
        body: JSON.stringify({ question, max_tokens: MAX_TOKENS, mode: 'public_demo' }),
        signal: AbortSignal.timeout(15_000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return NextResponse.json({ answer: data.answer ?? FALLBACK_ANSWER });
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: return curated demo answer
  return NextResponse.json({ answer: FALLBACK_ANSWER });
}
