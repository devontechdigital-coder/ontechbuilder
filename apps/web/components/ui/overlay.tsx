"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import toast from "react-hot-toast";
import { cn } from "../../lib/utils";
import { Button, IconButton } from "./button";

export function Dialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-secondary/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-surface p-5 shadow-xl shadow-slate-950/10 focus-visible:outline-none">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog(props: Parameters<typeof Dialog>[0]) {
  return <Dialog {...props} />;
}

export function Modal({
  open,
  title,
  description,
  children,
  className,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-secondary/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border bg-surface shadow-xl shadow-slate-950/10 focus-visible:outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
          <div className="min-h-0 overflow-y-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Sheet({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-secondary/35 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 grid h-full w-full max-w-md grid-rows-[auto_minmax(0,1fr)] border-l bg-surface shadow-xl shadow-slate-950/10">
          <div className="flex items-center justify-between gap-3 border-b p-5">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">{title}</DialogPrimitive.Title>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-4" />
            </IconButton>
          </div>
          <div className="grid min-h-0 content-start gap-4 overflow-y-auto p-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Dropdown({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <Button type="button" variant="secondary" size="sm">
          {label}
        </Button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          className="z-50 grid min-w-40 gap-2 rounded-lg border bg-surface p-2 shadow-lg shadow-slate-950/10"
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  useEffect(() => {
    toast.success(typeof children === "string" ? children : "Saved successfully");
  }, [children]);

  return null;
}
