"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Alert } from "../../components/ui/display";
import { Button } from "../../components/ui/button";
import { Field, Input } from "../../components/ui/form";
import { apiRequest } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          displayName: form.get("displayName"),
          tenantName: form.get("tenantName"),
          tenantSlug: form.get("tenantSlug"),
        }),
      });
      router.push("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center gap-8 px-4 py-8 md:grid-cols-[minmax(0,0.92fr)_minmax(360px,420px)] md:px-8">
      <section className="grid max-w-xl justify-items-center gap-4 text-center md:justify-items-start md:text-left" aria-label="Workspace setup summary">
        <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-sm font-black text-white">S</div>
        <p className="text-xs font-bold uppercase tracking-normal text-primary">Workspace setup</p>
        <h1 className="max-w-[12ch] text-4xl font-black leading-none tracking-normal text-foreground md:text-6xl">
          Create the account and first tenant together.
        </h1>
        <p className="max-w-lg text-base leading-7 text-muted-foreground">The application stores account and tenant metadata only; uploaded files remain in object storage through the backend flow.</p>
      </section>
      <form className="grid w-full max-w-[420px] gap-5 rounded-xl border bg-surface p-6 shadow-xl shadow-slate-950/5 md:p-8" onSubmit={submit}>
        <p className="text-xs font-bold uppercase tracking-normal text-primary">Create account</p>
        <h2 className="text-2xl font-bold text-foreground">Start a workspace</h2>
        <p className="text-sm leading-6 text-muted-foreground">Create your first tenant and begin managing websites with tenant-safe access.</p>
        <Field label="Name">
          <Input name="displayName" autoComplete="name" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint="Use at least 12 characters.">
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <Field label="Workspace name">
          <Input name="tenantName" required />
        </Field>
        <Field label="Workspace slug">
          <Input name="tenantSlug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating" : "Create account"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link className="font-semibold text-primary" href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
