import type { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/server/auth";
import { generalLimiter, checkRateLimit } from "@/lib/rate-limit";
import {
  addSessionMessage,
  createDoubtSession,
  deleteDoubtSession,
  getDoubtSession,
  listDoubtSessions,
  updateDoubtSession,
} from "@/server/interaction";
import {
  badRequest,
  created,
  getSlugSegments,
  noContent,
  notFound,
  ok,
  parseJsonBody,
  unauthorized,
} from "@/server/http";
import { readStoreAsync, withStoreAsync } from "@/server/store";

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

async function resolveSlug(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return getSlugSegments(params);
}

function sessionIdentifier(request: NextRequest): string {
  return (
    request.headers.get("x-origin-user-id") ??
    request.cookies.get("origin_access_token")?.value ??
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.headers.get("x-forwarded-for") ??
    "unknown"
  );
}

function validateBaseRoute(slug: string[]) {
  if (slug.length === 0 || slug[0] !== "doubts") {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug)) {
    return notFound();
  }

  const limited = await checkRateLimit(generalLimiter, sessionIdentifier(request));
  if (limited) return limited;

  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) {
    return unauthorized();
  }

  if (slug.length === 1) {
    return ok(listDoubtSessions(store, user.id));
  }

  if (slug.length === 2) {
    const session = getDoubtSession(store, user.id, slug[1]);
    if (!session) {
      return notFound("Doubt session not found.");
    }
    return ok(session);
  }

  return notFound();
}

export async function POST(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug)) {
    return notFound();
  }

  const limited = await checkRateLimit(generalLimiter, sessionIdentifier(request));
  if (limited) return limited;

  if (slug.length === 1) {
    let payload: { title?: string; subject?: string };
    try {
      payload = await parseJsonBody<{ title?: string; subject?: string }>(request);
    } catch {
      return badRequest("Invalid JSON payload.");
    }
    const result = await withStoreAsync(async (store) => {
      const user = await requireUserFromRequest(store, request);
      if (!user) {
        return { status: "unauthorized" as const };
      }
      const session = createDoubtSession(store, user.id, payload);
      return { status: "created" as const, session };
    });

    if (result.status === "unauthorized") {
      return unauthorized();
    }
    return created(result.session);
  }

  if (slug.length === 3 && slug[2] === "add_message") {
    let payload: { content?: string; image?: string };
    try {
      payload = await parseJsonBody<{ content?: string; image?: string }>(request);
    } catch {
      return badRequest("Invalid JSON payload.");
    }
    try {
      const result = await withStoreAsync(async (store) => {
        const user = await requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }
        const reply = await addSessionMessage(store, user, slug[1], payload);
        return { status: "ok" as const, reply };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }
      const { reply } = result;
      if (!reply) {
        return notFound("Doubt session not found.");
      }
      if ("error" in reply && typeof reply.error === "string") {
        return badRequest(reply.error, { error: reply.error });
      }
      return created(reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to solve doubt right now.";
      console.error("[add_message]", err);
      return badRequest(message);
    }
  }

  return notFound();
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug) || slug.length !== 2) {
    return notFound();
  }

  const limited = await checkRateLimit(generalLimiter, sessionIdentifier(request));
  if (limited) return limited;

  try {
    const payload = await parseJsonBody<{ title?: string; subject?: string }>(request);
    const result = await withStoreAsync(async (store) => {
      const user = await requireUserFromRequest(store, request);
      if (!user) {
        return { status: "unauthorized" as const };
      }
      const session = updateDoubtSession(store, user.id, slug[1], payload);
      if (!session) {
        return { status: "not_found" as const };
      }
      return { status: "ok" as const, session };
    });

    if (result.status === "unauthorized") {
      return unauthorized();
    }
    if (result.status === "not_found") {
      return notFound("Doubt session not found.");
    }
    return ok(result.session);
  } catch {
    return badRequest("Invalid JSON payload.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug) || slug.length !== 2) {
    return notFound();
  }

  const limited = await checkRateLimit(generalLimiter, sessionIdentifier(request));
  if (limited) return limited;

  const result = await withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return { status: "unauthorized" as const };
    }
    const removed = deleteDoubtSession(store, user.id, slug[1]);
    return { status: removed ? ("deleted" as const) : ("not_found" as const) };
  });

  if (result.status === "unauthorized") {
    return unauthorized();
  }
  if (result.status === "not_found") {
    return notFound("Doubt session not found.");
  }
  return noContent();
}
