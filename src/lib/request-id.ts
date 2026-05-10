import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "X-Request-Id";

export function createRequestId(): string {
  return randomUUID();
}

export function getRequestId(headers?: Headers | null): string {
  return headers?.get(REQUEST_ID_HEADER) ?? headers?.get(REQUEST_ID_HEADER.toLowerCase()) ?? createRequestId();
}
