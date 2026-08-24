"use client";

import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import toast, { resolveValue, Toaster, type Toast, type ToastType } from "react-hot-toast";
import { cn } from "../../lib/utils";

type ToastTone = "success" | "error" | "loading" | "info" | "warning";

interface ToneMeta {
  icon: ComponentType<{ className?: string }>;
  cssVar: string;
  iconBg: string;
  border: string;
  title: string;
}

const TONE_META: Record<ToastTone, ToneMeta> = {
  success: { icon: CheckCircle2, cssVar: "--success", iconBg: "bg-success", border: "border-success/30", title: "Success" },
  error: { icon: XCircle, cssVar: "--destructive", iconBg: "bg-destructive", border: "border-destructive/30", title: "Something went wrong" },
  loading: { icon: Loader2, cssVar: "--info", iconBg: "bg-info", border: "border-info/30", title: "Please wait" },
  warning: { icon: AlertTriangle, cssVar: "--warning", iconBg: "bg-warning", border: "border-warning/30", title: "Warning" },
  info: { icon: Info, cssVar: "--info", iconBg: "bg-info", border: "border-info/30", title: "Notice" },
};

function toneFromType(type: ToastType): ToastTone {
  if (type === "success" || type === "error" || type === "loading") return type;
  return "info";
}

/**
 * Renders every toast.success/toast.error/toast.loading(...) call already used across the
 * dashboard into a shadcn-style card (tinted border + circular icon badge + title/description +
 * dismiss button + slide-in animation) without touching any of those call sites — the tone is
 * derived from react-hot-toast's own toast type, and the existing message becomes the description.
 */
function CustomToast({ t }: { t: Toast }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const tone = toneFromType(t.type);
  const meta = TONE_META[tone];
  const Icon = meta.icon;
  const shown = entered && t.visible;

  return (
    <div
      role={t.ariaProps.role}
      aria-live={t.ariaProps["aria-live"]}
      style={{ backgroundColor: `color-mix(in srgb, hsl(var(${meta.cssVar})) 10%, hsl(var(--surface)))` }}
      className={cn(
        "pointer-events-auto flex w-[380px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border-2 p-3.5 shadow-lg shadow-slate-950/10 transition-all duration-300 ease-out",
        meta.border,
        shown ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-white transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          meta.iconBg,
          shown ? "scale-100 rotate-0" : "scale-0 -rotate-45",
        )}
      >
        <Icon className={cn("size-4.5", tone === "loading" ? "animate-spin" : "")} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-semibold leading-5 text-foreground">{meta.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">{resolveValue(t.message, t)}</p>
      </div>
      {tone !== "loading" ? (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => toast.dismiss(t.id)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function AppToaster() {
  return (
    <Toaster position="top-right" gutter={10} toastOptions={{ duration: 3200 }}>
      {(t) => <CustomToast t={t} />}
    </Toaster>
  );
}
