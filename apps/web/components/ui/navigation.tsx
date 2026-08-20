"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { Button } from "./button";

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      <TabsPrimitive.List className="inline-flex w-full gap-1 overflow-x-auto rounded-lg border bg-surface p-1 sm:w-auto" aria-label="Website sections">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

export function Pagination({
  hasPrevious,
  hasNext,
  label,
  onPrevious,
  onNext,
}: {
  hasPrevious?: boolean;
  hasNext: boolean;
  label?: string;
  onPrevious?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={!hasPrevious} onClick={onPrevious}>
          Previous
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={!hasNext} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function Table({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-secondary text-left text-xs font-bold uppercase text-muted-foreground">
            {headers.map((header, index) => (
              <th key={index} className="border-b px-3 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:px-3 [&_td]:py-3 [&_tr:last-child_td]:border-b-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}
