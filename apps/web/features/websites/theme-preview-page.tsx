"use client";

import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Badge } from "../../components/ui/display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser } from "../auth/types";
import { isThemeFrameMessage, postToFrame, THEME_FRAME_READY, THEME_FRAME_UPDATE } from "./customizer/frame-protocol";
import { getAllGroupSections, getCustomizerPageOptions, resolvePageTemplateId } from "./customizer/state";
import { resolveThemeRenderer } from "./customizer/theme-renderer";
import type { CustomizerPageOption } from "./customizer/types";
import type { PageSummary, ThemeDraftSummary, ThemeInstallationSummary, WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

export function ThemePreviewPage({ params }: { params: Promise<{ id: string; themeId: string }> }) {
  const { id: websiteId, themeId } = use(params);
  const router = useRouter();
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [theme, setTheme] = useState<ThemeInstallationSummary | null>(null);
  const [draft, setDraft] = useState<ThemeDraftSummary | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const meResponse = await apiRequest<MeResponse>("/auth/me");
        if (!meResponse.activeTenant) {
          router.push("/login");
          return;
        }
        const [websiteResponse, themesResponse, draftResponse, pagesResponse] = await Promise.all([
          apiRequest<WebsiteSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}`),
          apiRequest<ThemeInstallationSummary[]>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes`),
          apiRequest<ThemeDraftSummary>(`/tenants/${meResponse.activeTenant.id}/websites/${websiteId}/themes/${themeId}/draft`),
          apiRequest<PageSummary[]>(`/websites/${websiteId}/pages`),
        ]);
        setWebsite(websiteResponse);
        setTheme(themesResponse.find((item) => item.id === themeId) ?? null);
        setDraft(draftResponse);
        setPages(pagesResponse);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Preview failed to load");
        router.push(`/websites/${websiteId}/themes`);
      }
    }

    void load();
  }, [router, themeId, websiteId]);

  const { sectionSchemas, getTemplateScope } = useMemo(() => resolveThemeRenderer(theme, draft), [draft, theme]);
  const pageOptions = useMemo(() => getCustomizerPageOptions(pages, draft), [draft, pages]);
  const selectedPage = pageOptions.find((page) => page.id === selectedPageId) ?? pageOptions[0] ?? null;
  const pageKey = selectedPage?.id ?? "template-home";
  const templateId = useMemo(() => resolvePageTemplateId(selectedPage), [selectedPage]);
  const templateScope = useMemo(() => getTemplateScope(templateId), [getTemplateScope, templateId]);
  const groups = useMemo(
    () => getAllGroupSections(draft?.settings ?? {}, pageKey, sectionSchemas, templateScope),
    [draft, pageKey, sectionSchemas, templateScope],
  );

  useEffect(() => {
    if (!selectedPageId && pageOptions[0]) {
      setSelectedPageId(pageOptions[0].id);
    }
  }, [pageOptions, selectedPageId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isThemeFrameMessage(event.data)) return;
      if (event.data.type === THEME_FRAME_READY) {
        setFrameReady(true);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!frameReady || !website || !draft) return;
    const message = {
      type: THEME_FRAME_UPDATE,
      payload: {
        groups,
        sectionSchemas,
        page: selectedPage,
        templateId,
        settings: draft.settings,
        selected: { kind: "theme" },
        websiteName: website.name,
        editable: false,
        templateSupportsSections: templateScope.supportsSections,
        // Non-editable preview — never renders the overlay, so this has no visible effect.
        sidebarMinimized: true,
      },
    } as const;
    postToFrame(iframeRef.current?.contentWindow, message);
    const retryTimers = [
      window.setTimeout(() => postToFrame(iframeRef.current?.contentWindow, message), 120),
      window.setTimeout(() => postToFrame(iframeRef.current?.contentWindow, message), 420),
    ];
    return () => retryTimers.forEach((timer) => window.clearTimeout(timer));
  }, [draft, frameReady, groups, sectionSchemas, selectedPage, templateId, templateScope, website]);

  const previewReady = Boolean(website && draft);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {previewReady ? (
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2.5 border-b bg-surface px-3 shadow-sm shadow-slate-950/5">
        <Link
          href={`/websites/${websiteId}/themes`}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to themes"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 border-l pl-2.5">
          <p className="truncate text-[12.5px] font-semibold text-foreground">{website?.name}</p>
          <Badge tone="warning">Draft preview</Badge>
        </div>
        <div className="mx-auto">
          <PageSwitcher onChange={setSelectedPageId} page={selectedPage} pageOptions={pageOptions} />
        </div>
        <p className="ml-auto hidden text-[11.5px] text-muted-foreground sm:block">Not published — visible to you only</p>
      </header>
      ) : null}

      <main className="relative flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          title="Website preview"
          src={`/websites/${websiteId}/themes/${themeId}/frame`}
          className={`${previewReady ? "h-[calc(100svh-3rem)]" : "h-svh"} w-full border-0 bg-white`}
          onLoad={() => setFrameReady(true)}
        />
      </main>
    </div>
  );
}

function PageSwitcher({ onChange, page, pageOptions }: { onChange: (pageId: string) => void; page: CustomizerPageOption | null; pageOptions: CustomizerPageOption[] }) {
  if (pageOptions.length <= 1) {
    return <span className="text-[12.5px] font-medium text-foreground">{page?.label ?? "Home page"}</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-foreground shadow-sm shadow-slate-950/5 transition-colors hover:bg-surface-secondary">
          <span className="max-w-52 truncate">{page?.label ?? "Home page"}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-80 min-w-64 overflow-y-auto">
        <DropdownMenuLabel>Pages</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pageOptions.map((option) => (
          <DropdownMenuItem key={option.id} onSelect={() => onChange(option.id)}>
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.id === page?.id ? <span className="size-1.5 shrink-0 rounded-full bg-info" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
