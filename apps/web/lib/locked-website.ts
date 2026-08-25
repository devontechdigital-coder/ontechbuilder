const LOCKED_WEBSITE_KEY = "stackbuilder-locked-website-id";

/** Set once a user signs in through /admin on a custom domain — scopes the whole dashboard to that one website. */
export function readLockedWebsiteId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(LOCKED_WEBSITE_KEY);
}

export function writeLockedWebsiteId(websiteId: string) {
  window.sessionStorage.setItem(LOCKED_WEBSITE_KEY, websiteId);
}

export function clearLockedWebsiteId() {
  window.sessionStorage.removeItem(LOCKED_WEBSITE_KEY);
}
