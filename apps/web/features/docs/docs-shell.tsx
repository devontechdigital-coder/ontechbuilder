"use client";

import { ArrowLeft, ArrowRight, BookOpen, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { DOC_GROUPS, getAdjacentTopics } from "./topics";

export function DocsShell({ activeSlug, children }: { activeSlug: string; children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { previous, next } = getAdjacentTopics(activeSlug);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-[13px] font-black text-white">S</span>
            <span className="text-[13px] font-bold uppercase tracking-wide text-foreground">StackBuilder</span>
          </Link>
          <span className="hidden text-muted-foreground/40 sm:inline">/</span>
          <span className="hidden items-center gap-1.5 text-[13px] font-semibold text-muted-foreground sm:flex">
            <BookOpen className="size-3.5" />
            Theme developer docs
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/login" variant="secondary" size="sm">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1240px] items-start">
        <aside
          className={cn(
            "fixed inset-y-14 left-0 z-30 w-72 shrink-0 overflow-y-auto border-r bg-surface p-4 transition-transform lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:translate-x-0",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav aria-label="Documentation">
            {DOC_GROUPS.map((group) => (
              <div key={group.title} className="mb-5">
                <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">{group.title}</p>
                <ul className="grid gap-0.5">
                  {group.topics.map((topic) => {
                    const active = topic.slug === activeSlug;
                    return (
                      <li key={topic.slug}>
                        <Link
                          href={`/docs/${topic.slug}`}
                          onClick={() => setMobileNavOpen(false)}
                          className={cn(
                            "block rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                            active ? "bg-accent/10 text-accent" : "text-foreground/80 hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {topic.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {mobileNavOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-20 bg-secondary/30 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <main className="min-w-0 flex-1 px-5 py-10 md:px-10">
          {children}

          <nav className="mt-14 flex items-center justify-between gap-3 border-t pt-6" aria-label="Topic navigation">
            {previous ? (
              <Link href={`/docs/${previous.slug}`} className="group flex min-w-0 items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <ArrowLeft className="size-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                <span className="truncate">{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/docs/${next.slug}`} className="group flex min-w-0 items-center gap-2 text-right text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <span className="truncate">{next.title}</span>
                <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>
      </div>
    </div>
  );
}
