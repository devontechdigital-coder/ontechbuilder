"use client";

import { useEffect } from "react";

const SESSION_KEY = "sb_session_id";
const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function getSessionId(): string {
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Fires once per page render — a tenant's own dashboard reads what this records via
 * apps/api's AnalyticsService (Live View / Analytics pages). Session id lives in
 * sessionStorage (a real browser tab session, not a persistent visitor id) so a returning
 * visitor's later visit counts as a new session, matching what "sessions" means everywhere else
 * in the Analytics dashboard. Best-effort: a failed beacon never affects the page itself.
 */
export function PageViewTracker({ websiteId, pageId, path }: { websiteId: string; pageId?: string; path: string }) {
  useEffect(() => {
    try {
      const sessionId = getSessionId();
      void fetch(`${publicApiBaseUrl}/public/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, pageId, path, referrer: document.referrer || undefined, sessionId }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // sessionStorage/crypto unavailable (privacy mode, very old browser, ...) — tracking is best-effort only.
    }
  }, [websiteId, pageId, path]);

  return null;
}
