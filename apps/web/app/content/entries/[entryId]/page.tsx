"use client";

import { FileText, Send } from "lucide-react";
import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../../components/layout/dashboard-shell";
import { Button, ButtonLink } from "../../../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader } from "../../../../components/ui/display";
import { apiRequest } from "../../../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../../../features/auth/types";
import type { PageResult } from "../../../../features/websites/types";
import type { ContentEntry, ContentEntryVersion, ContentTypeSummary } from "../../../../features/cms/types";
import { EntryStatusBadge, FieldRenderer, entryTitle } from "../../../../features/cms/field-renderer";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

interface EntryPageProps {
  params: Promise<{ entryId: string }>;
}

export default function EntryPage({ params }: EntryPageProps) {
  const { entryId } = use(params);
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [entry, setEntry] = useState<ContentEntry | null>(null);
  const [contentType, setContentType] = useState<ContentTypeSummary | null>(null);
  const [versions, setVersions] = useState<ContentEntryVersion[]>([]);
  const [entryData, setEntryData] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);
        await loadEntry();
      } catch {
        router.push("/login");
      }
    }

    void load();
  }, [router, entryId]);

  async function switchTenant(tenantId: string) {
    await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    router.push("/content");
  }

  async function loadEntry() {
    const entryResponse = await apiRequest<ContentEntry>(`/content-entries/${entryId}`);
    const [typeResponse, versionsResponse] = await Promise.all([
      apiRequest<ContentTypeSummary>(`/content-types/${entryResponse.contentTypeId}`),
      apiRequest<PageResult<ContentEntryVersion>>(`/content-entries/${entryId}/versions?limit=20`),
    ]);
    setEntry(entryResponse);
    setEntryData(entryResponse.data);
    setContentType(typeResponse);
    setVersions(versionsResponse.data);
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      await apiRequest<ContentEntry>(`/content-entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ data: entryData }),
      });
      await loadEntry();
      setMessage("Draft saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Entry update failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function publishEntry() {
    if (!entry?.draftVersionId) {
      setError("Save a draft before publishing.");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/content-entries/${entry.id}/versions/${entry.draftVersionId}/publish`, { method: "POST" });
      await loadEntry();
      setMessage("Entry published.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Publish failed");
    }
  }

  if (!me || !entry || !contentType) {
    return <LoadingState label="Loading entry" />;
  }

  const fields = contentType.fields ?? [];

  return (
    <DashboardShell
      title={entryTitle(entry, fields)}
      eyebrow={contentType.name}
      description="View and edit this content entry on its own page."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Content", href: "/content" }, { label: contentType.name, href: `/content/types/${contentType.id}` }, { label: "Entry" }]}
      onTenantChange={switchTenant}
      actions={
        <>
          <ButtonLink href={`/content/types/${contentType.id}`} variant="secondary">Back</ButtonLink>
          <Button type="button" variant="secondary" onClick={() => void publishEntry()} disabled={!entry.draftVersionId}>
            <Send className="size-4" />
            Publish
          </Button>
        </>
      }
    >
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card><Metric label="Status" value={<EntryStatusBadge status={entry.status} />} helper="Current entry state" /></Card>
        <Card><Metric label="Draft" value={entry.draftVersionId ? "Ready" : "None"} helper="Latest draft pointer" /></Card>
        <Card><Metric label="Published" value={entry.publishedVersionId ? "Ready" : "None"} helper="Published version pointer" /></Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <SectionHeader title="Content fields" description="Generated from the content type schema." />
          {fields.length ? (
            <form className="grid gap-5" onSubmit={saveEntry}>
              <div className="grid gap-4 lg:grid-cols-2">
                {fields.map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={entryData[field.slug]}
                    onChange={(value) => setEntryData((current) => ({ ...current, [field.slug]: value }))}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button type="submit" disabled={isSaving}>
                  <FileText className="size-4" />
                  {isSaving ? "Saving" : "Save Draft"}
                </Button>
              </div>
            </form>
          ) : (
            <EmptyState title="No fields configured" description="This content type does not have active fields." />
          )}
        </Card>

        <Card>
          <SectionHeader title="Version history" description="Most recent entry versions." />
          {versions.length ? (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-surface-secondary text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Version</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {versions.map((version) => (
                    <tr key={version.id}>
                      <td className="px-3 py-2">v{version.versionNumber}</td>
                      <td className="px-3 py-2">
                        <Badge tone={version.status === "PUBLISHED" ? "success" : "info"}>{version.status.toLowerCase()}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(version.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No versions" description="Save the entry to create its first version." />
          )}
        </Card>
      </section>
    </DashboardShell>
  );
}

function Metric({ label, value, helper }: { label: string; value: React.ReactNode; helper: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <strong className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular">{value}</strong>
      <p className="text-[11.5px] text-muted-foreground">{helper}</p>
    </div>
  );
}
