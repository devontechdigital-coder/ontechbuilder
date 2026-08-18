"use client";

import { LogOut, MoreVertical, UserCircle } from "lucide-react";
import type { SafeUser } from "../../features/auth/types";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";

export function NavUser({ user, onLogout }: { user: SafeUser; onLogout: () => Promise<void> }) {
  const { isMobile } = useSidebar();
  const displayName = user.displayName ?? user.email;
  const initials = getInitials(displayName);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              title={displayName}
              className="h-11 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground data-[state=open]:shadow-sm data-[state=open]:ring-1 data-[state=open]:ring-sidebar-border"
            >
              <Avatar className="size-7 rounded-md">
                <AvatarFallback className="text-[11px] font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[sidebar-open=false]/sidebar-wrapper:hidden">
                <span className="truncate text-[12.5px] font-semibold text-foreground">{displayName}</span>
                <span className="truncate text-[11px] text-sidebar-foreground/60">{user.email}</span>
              </div>
              <MoreVertical className="ml-auto !size-3.5 group-data-[sidebar-open=false]/sidebar-wrapper:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserCircle className="size-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void onLogout()}>
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function getInitials(value: string): string {
  const words = value.split(/[\s@._-]+/).filter(Boolean);
  return (words[0]?.[0] ?? "U").concat(words[1]?.[0] ?? "").toUpperCase();
}
