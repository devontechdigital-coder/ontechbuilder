"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "../../components/ui/button";
import { EmptyState, LoadingState } from "../../components/ui/display";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser } from "../auth/types";
import { ThemeCustomizerPage } from "./theme-customizer-page";
import type { PageSummary, ThemeInstallationSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

/**
 * Shared resolver behind both /builder/pages/[pageId] and /builder/blog/[blogId] — a blog post is
 * stored as a Page record too (same shape, distinguished by blogCategoryId; see
 * website-workspace.tsx's shared pages/blogs table), so both routes resolve their id through the
 * same /pages/:id endpoint and hand off to the same customizer. Keeping this logic in one place
 * means any change to how the builder resolves or launches applies to both routes automatically —
 * the two page.tsx files are thin wrappers with no logic of their own.
 */
export function BuilderPageResolver({ pageId }: { pageId: string }) {
  const router = useRouter();
  const [page, setPage] = useState<PageSummary | null>(null);
  // undefined = still resolving, null = website has no theme installed yet.
  const [themeId, setThemeId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const me = await apiRequest<MeResponse>("/auth/me");
        if (!me.activeTenant) {
          router.push("/login");
          return;
        }
        const pageResponse = await apiRequest<PageSummary>(`/pages/${pageId}`);
        if (cancelled) return;
        setPage(pageResponse);

        const themes = await apiRequest<ThemeInstallationSummary[]>(
          `/tenants/${me.activeTenant.id}/websites/${pageResponse.websiteId}/themes`,
        );
        if (cancelled) return;
        const currentTheme = themes.find((theme) => theme.status === "PUBLISHED") ?? themes[0] ?? null;
        setThemeId(currentTheme?.id ?? null);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Builder failed to load");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pageId, router]);

  if (error) {
    return <BuilderResolveState title="Builder failed to load" description={error} />;
  }

  if (!page || themeId === undefined) {
    return <LoadingState label="Loading builder" />;
  }

  if (!themeId) {
    return (
      <BuilderResolveState
        title="No theme installed"
        description="Install a theme for this website before using the builder."
        websiteId={page.websiteId}
      />
    );
  }

  return <ThemeCustomizerPage websiteId={page.websiteId} themeId={themeId} initialPageId={pageId} />;
}

function BuilderResolveState({ description, title, websiteId }: { description: string; title: string; websiteId?: string }) {
  return (
    <main className="grid h-svh place-items-center bg-background px-6">
      <div className="w-full max-w-sm">
        <EmptyState
          title={title}
          description={description}
          action={
            <ButtonLink href={websiteId ? `/websites/${websiteId}` : "/"} variant="secondary" size="sm">
              Back to website
            </ButtonLink>
          }
        />
      </div>
    </main>
  );
}
