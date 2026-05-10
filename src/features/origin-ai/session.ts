'use client';

const ORIGIN_AI_BROWSER_SESSION_KEY = 'origin_ai_browser_session_id';

export function getOriginAiBrowserSessionId(): string {
  if (typeof window === 'undefined') {
    return 'origin-ai-server-fallback';
  }

  let sessionId = window.sessionStorage.getItem(ORIGIN_AI_BROWSER_SESSION_KEY);
  if (sessionId) {
    return sessionId;
  }

  sessionId = window.crypto?.randomUUID?.() ?? `origin-ai-${Date.now()}`;
  window.sessionStorage.setItem(ORIGIN_AI_BROWSER_SESSION_KEY, sessionId);
  return sessionId;
}

export function clearOriginAiBrowserSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(ORIGIN_AI_BROWSER_SESSION_KEY);
}
