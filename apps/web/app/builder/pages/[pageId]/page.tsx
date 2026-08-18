"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState, LoadingState } from "../../../../components/ui/display";
import { apiRequest } from "../../../../lib/api";
import type { ActiveTenant, SafeUser } from "../../../../features/auth/types";
import { ThemeCustomizerPage } from "../../../../features/websites/theme-customizer-page";
import type { PageSummary, ThemeInstallationSummary } from "../../../../features/websites/types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

interface BuilderPageProps {
  params: Promise<{ pageId: string }>;
}

/**
 * A page has no editor of its own — it's edited through its website's theme
 * customizer (features/websites/customizer), the same surface used at
 * /websites/:id/themes/:themeId/customize. This route only resolves
 * pageId -> the website's current theme installation, then hands off to
 * that customizer with this page preselected instead of the default (home).
 */
export default function BuilderPage({ params }: BuilderPageProps) {
  const { pageId } = use(params);
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

  return <ThemeCustomizerPage params={Promise.resolve({ id: page.websiteId, themeId })} initialPageId={pageId} />;
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
