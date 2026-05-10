import { createHmac, timingSafeEqual } from "node:crypto";

export type OptionPresentationScope =
  | "test"
  | "custom-test"
  | "room-test"
  | "dpp"
  | "practice"
  | "challenge";

export type OptionPresentationPayload = {
  v: 1;
  u: string;
  s: OptionPresentationScope;
  a: string;
  q: string;
  k: string;
  n: number;
};

export type OptionPresentationContext = {
  userId: string;
  scope: OptionPresentationScope;
  assessmentId: string;
  questionId: string;
  attemptKey: string | number;
  optionCount: number;
};

const TOKEN_VERSION = 1;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function getOptionPresentationSecret(explicitSecret?: string): string {
  const secret =
    explicitSecret ??
    process.env.OPTION_SHUFFLE_SECRET ??
    process.env.ROOM_CODE_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("OPTION_SHUFFLE_SECRET must be configured in production.");
  }

  return "origin-dev-option-shuffle-secret";
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function assertPayload(value: unknown): OptionPresentationPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as Partial<OptionPresentationPayload>;
  if (
    payload.v !== TOKEN_VERSION ||
    typeof payload.u !== "string" ||
    typeof payload.s !== "string" ||
    typeof payload.a !== "string" ||
    typeof payload.q !== "string" ||
    typeof payload.k !== "string" ||
    typeof payload.n !== "number" ||
    !Number.isInteger(payload.n) ||
    payload.n < 0
  ) {
    return null;
  }
  return payload as OptionPresentationPayload;
}

export function createOptionPresentationToken(
  context: OptionPresentationContext,
  explicitSecret?: string,
): string {
  const payload: OptionPresentationPayload = {
    v: TOKEN_VERSION,
    u: context.userId,
    s: context.scope,
    a: context.assessmentId,
    q: context.questionId,
    k: String(context.attemptKey),
    n: context.optionCount,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload, getOptionPresentationSecret(explicitSecret))}`;
}

export function verifyOptionPresentationToken(
  token: string | null | undefined,
  expected: Pick<OptionPresentationContext, "userId" | "questionId" | "optionCount"> &
    Partial<Pick<OptionPresentationContext, "scope" | "assessmentId">>,
  explicitSecret?: string,
): OptionPresentationPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }
  const expectedSignature = signPayload(encodedPayload, getOptionPresentationSecret(explicitSecret));
  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }
  const decoded = base64UrlDecode(encodedPayload);
  if (!decoded) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  const payload = assertPayload(parsed);
  if (!payload) {
    return null;
  }
  if (
    payload.u !== expected.userId ||
    payload.q !== expected.questionId ||
    payload.n !== expected.optionCount ||
    (expected.scope && payload.s !== expected.scope) ||
    (expected.assessmentId && payload.a !== expected.assessmentId)
  ) {
    return null;
  }
  return payload;
}

function rankIndex(payload: OptionPresentationPayload, index: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${payload.v}:${payload.u}:${payload.s}:${payload.a}:${payload.q}:${payload.k}:${payload.n}:${index}`)
    .digest("hex");
}

export function getOptionDisplayOrder(
  payload: OptionPresentationPayload,
  explicitSecret?: string,
): number[] {
  const secret = getOptionPresentationSecret(explicitSecret);
  const order = Array.from({ length: payload.n }, (_, index) => index).sort((left, right) => {
    const leftRank = rankIndex(payload, left, secret);
    const rightRank = rankIndex(payload, right, secret);
    return leftRank.localeCompare(rightRank);
  });

  if (order.length > 1 && order.every((value, index) => value === index)) {
    const rotation = (Number.parseInt(rankIndex(payload, payload.n, secret).slice(0, 8), 16) % (order.length - 1)) + 1;
    return order.slice(rotation).concat(order.slice(0, rotation));
  }

  return order;
}

export function presentOptions<T>(
  options: T[] | null | undefined,
  context: Omit<OptionPresentationContext, "optionCount">,
): { options: T[] | undefined; presentationId: string | undefined } {
  if (!options?.length) {
    return { options: options ?? undefined, presentationId: undefined };
  }

  const presentationId = createOptionPresentationToken({
    ...context,
    optionCount: options.length,
  });
  const payload = verifyOptionPresentationToken(presentationId, {
    userId: context.userId,
    questionId: context.questionId,
    optionCount: options.length,
    scope: context.scope,
    assessmentId: context.assessmentId,
  });
  if (!payload) {
    throw new Error("Failed to create option presentation token.");
  }

  const order = getOptionDisplayOrder(payload);
  return {
    options: order.map((index) => options[index]),
    presentationId,
  };
}
