import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Shared typography/code-block primitives for docs content — no MDX pipeline, just plain components so pages stay type-checked and linkable. */

export function DocH1({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-black tracking-tight text-foreground">{children}</h1>;
}

export function DocLead({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{children}</p>;
}

export function DocH2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 text-xl font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  );
}

export function DocH3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="mt-7 scroll-mt-24 text-[15px] font-bold tracking-tight text-foreground">
      {children}
    </h3>
  );
}

export function DocP({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[14px] leading-7 text-foreground/90">{children}</p>;
}

export function DocUl({ children }: { children: ReactNode }) {
  return <ul className="mt-3 grid gap-1.5 text-[14px] leading-6 text-foreground/90">{children}</ul>;
}

export function DocLi({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

export function DocCode({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">{children}</code>;
}

export function CodeBlock({ children, filename }: { children: string; filename?: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border bg-[#0b0b0d] text-[#e4e4e7]">
      {filename ? (
        <div className="border-b border-white/10 px-4 py-2 font-mono text-[11.5px] text-white/50">{filename}</div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-6">
        <code className="font-mono">{children.trim()}</code>
      </pre>
    </div>
  );
}

export function Callout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={cn(
        "mt-4 rounded-lg border px-4 py-3 text-[13px] leading-6",
        tone === "warning" ? "border-warning/30 bg-warning/10 text-warning-foreground" : "border-info/30 bg-info/10 text-foreground",
      )}
    >
      {children}
    </div>
  );
}

export function FieldTable({ rows }: { rows: Array<{ name: string; type: string; description: ReactNode }> }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b bg-surface-secondary/60">
            <th className="px-3 py-2 font-semibold text-foreground">Field</th>
            <th className="px-3 py-2 font-semibold text-foreground">Type</th>
            <th className="px-3 py-2 font-semibold text-foreground">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b last:border-b-0">
              <td className="px-3 py-2 align-top font-mono text-[12.5px] text-foreground">{row.name}</td>
              <td className="px-3 py-2 align-top font-mono text-[12px] text-muted-foreground">{row.type}</td>
              <td className="px-3 py-2 align-top text-foreground/90">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocSection({ children }: { children: ReactNode }) {
  return <article className="max-w-[720px]">{children}</article>;
}
