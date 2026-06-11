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
  if (!question || question.length < 5) {
    return NextResponse.json({ error: 'Question too short' }, { status: 400 });
  }
  if (isBlocked(question)) {
    return NextResponse.json({ error: 'Invalid question content' }, { status: 400 });
  }

  // Rate limit by IP: 8 solves per IP per week (matches client 5 text + 3 voice)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous';

  if (limiter) {
    const { success } = await limiter.limit(`ip:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Weekly preview limit reached. Create a free account for unlimited solves.' },
        { status: 429 }
      );
    }
  }

  // Connect to the SAME real pipeline the in-app Doubt Solver uses
  // (POST /api/v1/chat/message → run_pipeline: knowledge-base retrieval +
  // provider generation). The service trusts any forwarded user id as long as
  // the service token matches, so we forward a stable per-visitor guest id.
  // Memory stays scoped to that guest (bounded — the IP is rate-limited to a
  // handful of calls per week) and is never mixed with real student data.
  const serviceUrl = process.env.ORIGIN_AI_SERVICE_URL;
  const serviceToken = process.env.ORIGIN_AI_SERVICE_TOKEN;
  if (serviceUrl && serviceToken) {
    try {
      const guestId = `landing-demo:${ip}`;
      const resp = await fetch(`${serviceUrl}/api/v1/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
          'X-Origin-User-Id': guestId,
          'X-Origin-User-Name': 'Guest',
          'X-Origin-User-Email': '',
          'X-Origin-User-Role': 'student',
          'X-Origin-User-Streak': '0',
        },
        body: JSON.stringify({
          message: question,
          pageContext: { pathname: '/', pageKind: 'doubt_solver' },
          highlightedText: null,
          threadId: null,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { answer?: string };
        if (data.answer && data.answer.trim()) {
          return NextResponse.json({ answer: data.answer });
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: return curated demo answer when the service is unreachable
  return NextResponse.json({ answer: FALLBACK_ANSWER });
}
