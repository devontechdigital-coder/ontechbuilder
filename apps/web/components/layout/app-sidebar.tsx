"use client";

import {
  BarChart3,
  BookOpenText,
  ChevronsUpDown,
  CircleGauge,
  ClipboardList,
  Database,
  Folder,
  Image,
  LayoutList,
  Palette,
  PanelsTopLeft,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../features/auth/types";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { NavUser } from "./nav-user";

const navGroups = [
  {
    label: "Dashboards",
    items: [
      { label: "Classic Dashboard", href: "/", icon: CircleGauge },
      { label: "Websites", href: "/websites", icon: PanelsTopLeft },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Pages", href: "pages", icon: LayoutList },
      { label: "Blogs", href: "blogs", icon: BookOpenText },
      { label: "Blog Categories", href: "blogs/categories", icon: Folder },
      { label: "Forms", href: "forms", icon: ClipboardList },
      { label: "Leads", href: "leads", icon: Users },
      { label: "Themes", href: "themes", icon: Palette },
      { label: "Domains", href: "domains", icon: Database },
      { label: "Settings", href: "settings", icon: Settings },
    ],
  },
];
const globalNavGroups = navGroups.filter((group) => group.label !== "Content");
const websiteNavGroup = navGroups.find((group) => group.label === "Content");

const comingSoonItems = [
  { label: "Analytics", icon: BarChart3 },
  { label: "Media", icon: Image },
];

export function AppSidebar({
  user,
  activeTenant,
  tenants,
  onLogout,
}: {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
  tenants?: TenantSummary[];
  onLogout: () => Promise<void>;
}) {
  const pathname = usePathname() ?? "/";
  const activeTenantName =
    tenants?.find((tenant) => tenant.id === activeTenant?.id)?.name ?? activeTenant?.id.slice(0, 8);
  const websiteMatch = pathname.match(/^\/websites\/([^/]+)/);
  const websiteBasePath = websiteMatch ? `/websites/${websiteMatch[1]}` : null;
  const isWebsiteOpen = Boolean(websiteBasePath);

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/"
          className="flex h-9 items-center gap-2.5 rounded-md px-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 group-data-[sidebar-open=false]/sidebar-wrapper:justify-center group-data-[sidebar-open=false]/sidebar-wrapper:px-0"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-bold tracking-tight text-primary-foreground">
            SB
          </span>
          <span className="truncate text-[13.5px] font-semibold tracking-tight text-foreground group-data-[sidebar-open=false]/sidebar-wrapper:hidden">
            StackBuilder
          </span>
        </Link>

        <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-surface px-2.5 py-2 shadow-sm shadow-slate-950/5 group-data-[sidebar-open=false]/sidebar-wrapper:hidden">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[11px] font-semibold uppercase text-accent"
            aria-hidden="true"
          >
            {(activeTenantName ?? "?").slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">
              {activeTenantName ?? "No workspace"}
            </span>
            <span className="block truncate text-[11px] capitalize leading-tight text-sidebar-foreground/60">
              {activeTenant ? `${activeTenant.role.toLowerCase()} access` : "Select workspace"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-foreground/50" aria-hidden="true" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {globalNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={`${group.label}-${item.label}`}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href} title={item.label}>
                        <Icon />
                        <span className="truncate group-data-[sidebar-open=false]/sidebar-wrapper:hidden">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {isWebsiteOpen ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Content</SidebarGroupLabel>
              <SidebarMenu>
                {websiteNavGroup?.items.map((item) => {
                  const href = item.href === "pages" ? websiteBasePath ?? "/websites" : `${websiteBasePath}/${item.href}`;
                  const active = item.href === "pages" ? pathname === websiteBasePath : pathname.startsWith(href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={`website-${item.label}`}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link href={href} title={item.label}>
                          <Icon />
                          <span className="truncate group-data-[sidebar-open=false]/sidebar-wrapper:hidden">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Coming soon</SidebarGroupLabel>
              <SidebarMenu>
                {comingSoonItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton disabled className="opacity-55" title={`${item.label} — coming soon`}>
                        <Icon />
                        <span className="truncate group-data-[sidebar-open=false]/sidebar-wrapper:hidden">{item.label}</span>
                        <span className="ml-auto shrink-0 rounded border border-sidebar-border bg-surface px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/55 group-data-[sidebar-open=false]/sidebar-wrapper:hidden">
                          {item.label === "Leads" ? "New" : "Soon"}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  );
}
