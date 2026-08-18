export function Icon({ name }: { name: "overview" | "websites" | "pages" | "media" | "forms" | "leads" | "analytics" | "settings" | "user" }) {
  const paths = {
    overview: "M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z",
    websites: "M4 5h16v12H4V5Zm2 2v8h12V7H6Zm3 12h6",
    pages: "M6 3h9l3 3v15H6V3Zm8 1v4h4",
    media: "M5 5h14v14H5V5Zm3 10 3-3 2 2 2-3 3 4",
    forms: "M6 4h12v16H6V4Zm3 4h6M9 12h6M9 16h4",
    leads: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
    analytics: "M5 19V9m7 10V5m7 14v-7",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M3 12h3m12 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 12 0",
  };

  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
