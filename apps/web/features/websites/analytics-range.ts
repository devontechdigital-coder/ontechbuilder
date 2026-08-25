/** Shared by the Analytics dashboard and its "View all" (pages/sources) list pages, so the same range picker and query-param shape work identically everywhere. */
export const RANGE_TABS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Custom" },
];

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function buildRangeParams(rangeMode: string, customFrom: string, customTo: string): URLSearchParams {
  const params = new URLSearchParams();
  if (rangeMode === "custom" && customFrom && customTo) {
    params.set("from", customFrom);
    params.set("to", customTo);
  } else {
    params.set("days", rangeMode === "custom" ? "7" : rangeMode);
  }
  return params;
}

/** Recovers {rangeMode, customFrom, customTo} from a URL's search params (e.g. a "View all" link) — falls back to the 7-day default when nothing usable is present. */
export function parseRangeFromSearchParams(searchParams: URLSearchParams | null): { rangeMode: string; customFrom: string; customTo: string } {
  const from = searchParams?.get("from");
  const to = searchParams?.get("to");
  if (from && to) {
    return { rangeMode: "custom", customFrom: from, customTo: to };
  }
  const days = searchParams?.get("days");
  if (days && RANGE_TABS.some((tab) => tab.value === days)) {
    return { rangeMode: days, customFrom: daysAgoIso(30), customTo: todayIso() };
  }
  return { rangeMode: "7", customFrom: daysAgoIso(30), customTo: todayIso() };
}
