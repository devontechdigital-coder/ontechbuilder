"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Alert } from "../../components/ui/display";
import { Button, ButtonLink } from "../../components/ui/button";
import { Field, Input } from "../../components/ui/form";
import { apiRequest } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      router.push("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center gap-8 px-4 py-8 md:grid-cols-[minmax(0,0.92fr)_minmax(360px,420px)] md:px-8">
      <section className="grid max-w-xl justify-items-center gap-4 text-center md:justify-items-start md:text-left" aria-label="Product summary">
        <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-sm font-black text-white">S</div>
        <p className="text-xs font-bold uppercase tracking-normal text-primary">StackBuilder</p>
        <h1 className="max-w-[11ch] text-4xl font-black leading-none tracking-normal text-foreground md:text-6xl">
          Run every tenant website from one calm workspace.
        </h1>
        <p className="max-w-lg text-base leading-7 text-muted-foreground">Sign in to manage website records, domains, pages, and publishing state without crossing tenant boundaries.</p>
      </section>
      <form className="grid w-full max-w-[420px] gap-5 rounded-xl border bg-surface p-6 shadow-xl shadow-slate-950/5 md:p-8" onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-normal text-primary">Sign in</p>
        <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
        <p className="text-sm leading-6 text-muted-foreground">Use your workspace account to continue.</p>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in" : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground">
          New here? <Link className="font-semibold text-primary" href="/register">Create an account</Link>
        </p>
        <ButtonLink href="/register" variant="secondary">Create workspace</ButtonLink>
      </form>
    </main>
  );
}
