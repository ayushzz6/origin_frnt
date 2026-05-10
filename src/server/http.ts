import { NextResponse } from "next/server";

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return json(data, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse<T> {
  return json(data, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, extra: Record<string, unknown> = {}): NextResponse {
  return json({ detail: message, ...extra }, { status: 400 });
}

export function unauthorized(message = "Authentication credentials were not provided."): NextResponse {
  return json({ detail: message }, { status: 401 });
}

export function notFound(message = "Not found."): NextResponse {
  return json({ detail: message }, { status: 404 });
}

export function methodNotAllowed(): NextResponse {
  return json({ detail: "Method not allowed." }, { status: 405 });
}
export function forbidden(message = "You do not have permission to perform this action."): NextResponse {
  return json({ detail: message }, { status: 403 });
}

export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength === "0") {
    return {} as T;
  }

  const text = await request.text();
  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export function getSlugSegments(params: { slug?: string[] }): string[] {
  return (params.slug ?? []).filter(Boolean);
}
