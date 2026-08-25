"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "../../components/ui/display";
import { Button, ButtonLink } from "../../components/ui/button";
import { Field, Input } from "../../components/ui/form";
import { apiRequest } from "../../lib/api";
import { writeLockedWebsiteId } from "../../lib/locked-website";

interface DomainOwner {
  tenantId: string;
  websiteId: string;
  websiteName: string;
}

export default function DomainAdminLoginPage() {
  const router = useRouter();
  const [domainOwner, setDomainOwner] = useState<DomainOwner | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<DomainOwner>(`/public/sites/domain-owner?host=${encodeURIComponent(window.location.hostname)}`)
      .then(setDomainOwner)
      .catch((requestError) => {
        setResolveError(
          requestError instanceof Error ? requestError.message : "This domain isn't linked to a website yet",
        );
      })
      .finally(() => setIsResolving(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!domainOwner) return;
    setError(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      try {
        await apiRequest("/tenants/switch", {
          method: "POST",
          body: JSON.stringify({ tenantId: domainOwner.tenantId }),
        });
      } catch {
        await apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
        setError("Your account doesn't have access to this site.");
        setIsSubmitting(false);
        return;
      }
      writeLockedWebsiteId(domainOwner.websiteId);
      router.push(`/websites/${domainOwner.websiteId}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <form
        className="grid w-full max-w-[420px] gap-5 rounded-xl border bg-surface p-6 shadow-xl shadow-slate-950/5 md:p-8"
        onSubmit={submit}
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isResolving ? "Loading..." : (domainOwner?.websiteName ?? "Site admin")}
          </h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Sign in to manage this site.</p>
        </div>

        {resolveError ? (
          <Alert>{resolveError}</Alert>
        ) : (
          <>
            {error ? <Alert>{error}</Alert> : null}
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" required disabled={isResolving} />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required disabled={isResolving} />
            </Field>
            <Button type="submit" disabled={isResolving || isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </>
        )}

        <ButtonLink href="/login" variant="ghost" className="justify-self-center text-[12px]">
          Back to StackBuilder login
        </ButtonLink>
      </form>
    </main>
  );
}
