"use client";

import { PanelLeftIcon } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { useIsMobile } from "../../hooks/use-mobile";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";

type SidebarContextValue = {
  open: boolean;
  openMobile: boolean;
  isMobile: boolean;
  setOpen: (open: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

export function SidebarProvider({ children, className, ...props }: React.ComponentProps<"div">) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(true);
  const [openMobile, setOpenMobile] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((value) => !value);
      return;
    }
    setOpen((value) => !value);
  }, [isMobile]);

  const value = React.useMemo(
    () => ({ open, openMobile, isMobile, setOpen, setOpenMobile, toggleSidebar }),
    [open, openMobile, isMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        data-sidebar-open={open}
        className={cn("group/sidebar-wrapper flex min-h-svh w-full gap-0 bg-background p-0 md:p-2.5", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ children, className, ...props }: React.ComponentProps<"aside">) {
  const { isMobile, openMobile, setOpenMobile, open } = useSidebar();

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side="left" className="w-[264px] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Application navigation</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      data-slot="sidebar"
      data-state={open ? "expanded" : "collapsed"}
      className={cn(
        "hidden min-h-[calc(100svh-1.25rem)] shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex md:flex-col",
        open ? "w-[228px]" : "w-[60px]",
        className,
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return <main className={cn("flex min-w-0 flex-1 flex-col overflow-hidden border bg-surface shadow-sm shadow-slate-950/5 md:rounded-xl", className)} {...props} />;
}

export function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      className={cn("size-8", className)}
      size="icon"
      variant="ghost"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon className="size-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-3 p-3", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3 py-1", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-3", className)} {...props} />;
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-0.5", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/45 group-data-[sidebar-open=false]/sidebar-wrapper:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("grid gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("relative", className)} {...props} />;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-active={isActive}
      className={cn(
        // Layout: fixed 36px row, collapses to a centred icon square when the rail is closed.
        "group/menu-button relative flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-left text-[13px] font-medium outline-none",
        "transition-[background-color,color,box-shadow] duration-150",
        "group-data-[sidebar-open=false]/sidebar-wrapper:justify-center group-data-[sidebar-open=false]/sidebar-wrapper:px-0",
        // Resting + hover
        "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        // Active: raised white pill so the current page reads instantly against the tinted rail
        "data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground",
        "data-[active=true]:shadow-sm data-[active=true]:shadow-slate-950/5 data-[active=true]:ring-1 data-[active=true]:ring-sidebar-border",
        "data-[active=true]:[&>svg]:text-accent",
        "[&>svg]:size-[17px] [&>svg]:shrink-0 [&>svg]:text-sidebar-foreground/70",
        "hover:[&>svg]:text-sidebar-accent-foreground",
        "disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}
