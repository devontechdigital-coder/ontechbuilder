import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface FieldProps extends LabelHTMLAttributes<HTMLLabelElement> {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

const controlClasses =
  "flex min-h-8 w-full rounded-md border border-input bg-surface px-2.5 py-1.5 text-[12.5px] text-foreground shadow-sm shadow-slate-950/5 transition-colors placeholder:text-muted-foreground hover:border-muted-foreground/35 focus-visible:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60";

export function Field({ label, hint, error, children, className, ...props }: FieldProps) {
  return (
    <label className={cn("grid gap-1.5 text-[12.5px] font-medium text-foreground", className)} {...props}>
      <span>{label}</span>
      {children}
      {hint ? <span className="text-[11.5px] font-normal leading-4 text-muted-foreground">{hint}</span> : null}
      {error ? <span className="text-[11.5px] font-semibold text-destructive">{error}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClasses, "appearance-auto", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClasses, "min-h-24 resize-y leading-5", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex items-center gap-2 text-[12.5px] font-medium text-foreground", className)}>
      <input className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
