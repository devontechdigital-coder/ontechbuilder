"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../features/auth/types";
import { clearLockedWebsiteId, readLockedWebsiteId } from "../../lib/locked-website";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";

export function DashboardShell({
  title,
  description,
  eyebrow,
  breadcrumbs,
  me,
  tenants,
  actions,
  children,
  onTenantChange,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  me: { user: SafeUser; activeTenant: ActiveTenant | null };
  tenants?: TenantSummary[];
  actions?: ReactNode;
  children: ReactNode;
  onTenantChange?: (tenantId: string) => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [lockedWebsiteId, setLockedWebsiteId] = useState<string | null>(null);

  useEffect(() => {
    window.sessionStorage.setItem("stackbuilder-dashboard-shell-ready", "true");
    window.sessionStorage.setItem("stackbuilder-dashboard-shell-state", JSON.stringify({ me, tenants: tenants ?? [] }));
  }, [me, tenants]);

  useEffect(() => {
    setLockedWebsiteId(readLockedWebsiteId());
  }, []);

  useEffect(() => {
    if (!lockedWebsiteId) return;
    const allowedPrefix = `/websites/${lockedWebsiteId}`;
    if (pathname !== allowedPrefix && !pathname.startsWith(`${allowedPrefix}/`)) {
      router.replace(allowedPrefix);
    }
  }, [lockedWebsiteId, pathname, router]);

  async function logout() {
    const wasLocked = Boolean(lockedWebsiteId);
    clearLockedWebsiteId();
    await apiRequest("/auth/logout", { method: "POST" });
    router.push(wasLocked ? "/admin" : "/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={me.user}
        activeTenant={me.activeTenant}
        onLogout={logout}
        lockedWebsiteId={lockedWebsiteId}
        {...(tenants ? { tenants } : {})}
      />
      <SidebarInset>
        <SiteHeader
          title={title}
          activeTenant={me.activeTenant}
          {...(breadcrumbs ? { breadcrumbs } : {})}
          {...(!lockedWebsiteId && tenants ? { tenants } : {})}
          {...(!lockedWebsiteId && onTenantChange ? { onTenantChange } : {})}
        />

        <section className="bg-surface px-4 pb-4 pt-5 md:px-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-accent">{eyebrow}</p>
              ) : null}
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
              {description ? (
                <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-[1440px] content-start gap-4 px-4 pb-6 md:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
