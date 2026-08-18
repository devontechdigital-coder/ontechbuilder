"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "../../lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex w-full items-center gap-1 rounded-md border border-input bg-surface-secondary p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "flex-1 truncate rounded-[5px] px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground outline-none transition-colors data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:shadow-slate-950/10 focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-3.5 grid gap-4 outline-none", className)} {...props} />;
}
