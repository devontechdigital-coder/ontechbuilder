"use client";

import { Bell, ChevronRight, Moon, Palette, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ActiveTenant, TenantSummary } from "../../features/auth/types";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Select } from "../ui/form";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";

export function SiteHeader({
  title,
  breadcrumbs,
  tenants,
  activeTenant,
  actions,
  onTenantChange,
}: {
  title: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  tenants?: TenantSummary[];
  activeTenant: ActiveTenant | null;
  actions?: ReactNode;
  onTenantChange?: (tenantId: string) => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:px-5">
      <SidebarTrigger className="size-8 text-muted-foreground hover:text-foreground" />

      {/* Breadcrumb trail replaces the sr-only list — orientation is worth real pixels. */}
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 md:flex">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                {index > 0 ? <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" /> : null}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="truncate text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn("truncate text-[12.5px]", isLast ? "font-medium text-foreground" : "text-muted-foreground")}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="min-w-0 flex-1 md:hidden">
        <h1 className="truncate text-[13.5px] font-semibold text-foreground">{title}</h1>
      </div>

      <div className="relative ml-auto hidden w-full max-w-[300px] lg:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Search"
          className="h-8 w-full rounded-md border bg-surface-secondary pl-9 pr-12 text-[12.5px] outline-none transition-colors placeholder:text-muted-foreground hover:bg-muted focus:border-foreground/25 focus:bg-surface focus:ring-2 focus:ring-ring/10"
          placeholder="Search workspace..."
          type="search"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-surface px-1.5 py-px font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </span>
      </div>

      <div className="flex items-center gap-0.5 lg:ml-0">
        <button
          className="relative hidden size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid"
          type="button"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive ring-2 ring-surface" />
        </button>
        <button
          className="hidden size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid"
          type="button"
          aria-label="Toggle theme"
        >
          <Moon className="size-4" />
        </button>
        <button
          className="hidden size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid"
          type="button"
          aria-label="Appearance"
        >
          <Palette className="size-4" />
        </button>

        {tenants?.length && onTenantChange ? (
          <>
            <Separator orientation="vertical" className="mx-1.5 hidden h-5 xl:block" />
            <Select
              aria-label="Switch workspace"
              className="hidden !min-h-8 w-40 !px-2 !text-[12.5px] xl:block"
              value={activeTenant?.id ?? ""}
              onChange={(event) => void onTenantChange(event.target.value)}
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        {actions ? <div className="ml-1.5 flex items-center gap-2">{actions}</div> : null}

        <Separator orientation="vertical" className="mx-1.5 hidden h-5 sm:block" />
        <Avatar className="size-7 rounded-full">
          <AvatarFallback className="rounded-full bg-muted text-[11px] font-semibold text-foreground">
            {activeTenant?.role.slice(0, 1) ?? "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
