import { ArrowUpRight, BookOpen, Layers, Palette, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "../../components/ui/button";

/** Public, unauthenticated home page — what a visitor who isn't signed in sees at "/". */
export function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-6 md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-sm font-black text-white">S</span>
          <span className="text-[13px] font-bold uppercase tracking-wide text-foreground">StackBuilder</span>
        </div>
        <nav className="flex items-center gap-2">
          <ButtonLink href="/docs" variant="ghost" size="sm">
            <BookOpen className="size-3.5" />
            Docs
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Create workspace
          </ButtonLink>
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1100px] gap-6 px-4 pb-16 pt-10 text-center md:px-8 md:pb-24 md:pt-16">
        <p className="mx-auto text-xs font-bold uppercase tracking-wide text-primary">Multi-tenant website platform</p>
        <h1 className="mx-auto max-w-[18ch] text-4xl font-black leading-[1.05] tracking-tight text-foreground md:text-6xl">
          Run every tenant website from one calm workspace.
        </h1>
        <p className="mx-auto max-w-xl text-base leading-7 text-muted-foreground">
          Manage website records, domains, pages, and publishing state across every tenant — and build real,
          editable themes out of plain React components.
        </p>
        <div className="mx-auto flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/register" className="h-10 px-5 text-[13.5px]">
            Create a workspace
            <ArrowUpRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" className="h-10 px-5 text-[13.5px]">
            Sign in
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1100px] gap-3 px-4 pb-16 sm:grid-cols-3 md:px-8">
        <FeatureCard
          icon={Layers}
          title="Every tenant, one workspace"
          description="Website records, domains, pages, and publishing state, kept strictly within tenant boundaries."
        />
        <FeatureCard
          icon={Palette}
          title="Themes are real components"
          description="No template DSL — a theme is React components rendered live, with a full visual editor for free."
        />
        <FeatureCard icon={ShieldCheck} title="Sandboxed by design" description="Theme code runs isolated from the dashboard session — no access to cookies, storage, or other tenants." />
      </section>

      <section className="border-y bg-surface-secondary/40">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-4 px-4 py-14 text-center md:px-8">
          <BookOpen className="size-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Building a theme?</h2>
          <p className="max-w-md text-[14px] leading-6 text-muted-foreground">
            The developer docs cover the full theme package structure, the section &amp; block schema system,
            navigation menus, and exactly how your components get rendered — start to finish.
          </p>
          <ButtonLink href="/docs">
            Read the docs
            <ArrowUpRight className="size-4" />
          </ButtonLink>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-[12.5px] text-muted-foreground md:px-8">
        <span>&copy; {new Date().getFullYear()} StackBuilder</span>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="hover:text-foreground">Docs</Link>
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
          <Link href="/register" className="hover:text-foreground">Create workspace</Link>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-surface p-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
        <Icon className="size-4.5" />
      </span>
      <h3 className="mt-3 text-[14px] font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
