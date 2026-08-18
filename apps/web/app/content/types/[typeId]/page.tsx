"use client";

import { ArrowDown, ArrowUp, Eye, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../../components/layout/dashboard-shell";
import { Button, ButtonLink } from "../../../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader } from "../../../../components/ui/display";
import { Field, Input, Select } from "../../../../components/ui/form";
import { Sheet } from "../../../../components/ui/overlay";
import { apiRequest } from "../../../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../../../features/auth/types";
import type { PageResult } from "../../../../features/websites/types";
import type { ContentEntry, ContentField, ContentFieldType, ContentTypeSummary } from "../../../../features/cms/types";
import { EntryStatusBadge, entryTitle, fieldTypeOptions, formatFieldType } from "../../../../features/cms/field-renderer";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

interface ContentTypePageProps {
  params: Promise<{ typeId: string }>;
}

export default function ContentTypePage({ params }: ContentTypePageProps) {
  const { typeId } = use(params);
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [contentType, setContentType] = useState<ContentTypeSummary | null>(null);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [entryStatusFilter, setEntryStatusFilter] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [fieldOpen, setFieldOpen] = useState(false);
  const [fieldForm, setFieldForm] = useState<{ name: string; slug: string; type: ContentFieldType; required: boolean }>({
    name: "",
    slug: "",
    type: "TEXT",
    required: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const fields = useMemo(() => contentType?.fields ?? [], [contentType]);

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);
        await Promise.all([loadContentType(), loadEntries()]);
      } catch {
        router.push("/login");
      }
    }

    void load();
  }, [router, typeId]);

  async function switchTenant(tenantId: string) {
    await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    router.push("/content");
  }

  async function loadContentType() {
    const response = await apiRequest<ContentTypeSummary>(`/content-types/${typeId}`);
    setContentType(response);
  }

  async function loadEntries() {
    const params = new URLSearchParams({ limit: "40" });
    if (entryStatusFilter) {
      params.set("status", entryStatusFilter);
    }
    if (entrySearch.trim()) {
      params.set("query", entrySearch.trim());
    }
    const response = await apiRequest<PageResult<ContentEntry>>(
      `/content-types/${typeId}/entries?${params.toString()}`,
    );
    setEntries(response.data);
  }

  async function addField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsBusy(true);
    try {
      await apiRequest(`/content-types/${typeId}/fields`, {
        method: "POST",
        body: JSON.stringify(fieldForm),
      });
      setFieldForm({ name: "", slug: "", type: "TEXT", required: false });
      setFieldOpen(false);
      await loadContentType();
      setMessage("Field added.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Field creation failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function removeField(fieldId: string) {
    await runAction(async () => {
      await apiRequest(`/content-fields/${fieldId}`, { method: "DELETE" });
      await loadContentType();
      setMessage("Field archived.");
    });
  }

  async function reorderField(field: ContentField, direction: -1 | 1) {
    await runAction(async () => {
      await apiRequest(`/content-fields/${field.id}/reorder`, {
        method: "POST",
        body: JSON.stringify({ position: Math.max(0, field.position + direction) }),
      });
      await loadContentType();
    });
  }

  async function archiveEntry(entryId: string) {
    await runAction(async () => {
      await apiRequest(`/content-entries/${entryId}`, { method: "DELETE" });
      await loadEntries();
      setMessage("Entry archived.");
    });
  }

  async function runAction(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    setIsBusy(true);
    try {
      await action();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "CMS action failed");
    } finally {
      setIsBusy(false);
    }
  }

  if (!me || !contentType) {
    return <LoadingState label="Loading content type" />;
  }

  return (
    <DashboardShell
      title={contentType.name}
      eyebrow="Content"
      description={contentType.description ?? "Manage fields and entries for this structured collection."}
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Content", href: "/content" }, { label: contentType.name }]}
      onTenantChange={switchTenant}
      actions={
        <>
          <ButtonLink href="/content" variant="secondary">Back</ButtonLink>
          <Button type="button" variant="secondary" onClick={() => void Promise.all([loadContentType(), loadEntries()])}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <ButtonLink href={`/content/types/${contentType.id}/entries/new`}>
            <Plus className="size-4" />
            Add Entry
          </ButtonLink>
        </>
      }
    >
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card><Metric label="Fields" value={fields.length} helper="Active field definitions" /></Card>
        <Card><Metric label="Entries" value={entries.length} helper="Current filtered entries" /></Card>
        <Card><Metric label="Slug" value={contentType.slug} helper="Unique inside this website" /></Card>
      </section>

      <Card>
        <SectionHeader
          title="Fields"
          description="Field slugs are stable keys used inside entry JSON."
          actions={<Button type="button" size="sm" onClick={() => setFieldOpen(true)}><Plus className="size-4" /> Add Field</Button>}
        />
        {fields.length ? (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-surface-secondary text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Required</th>
                  <th className="px-4 py-3 font-semibold">Position</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map((field) => (
                  <tr key={field.id}>
                    <td className="px-4 py-3"><strong>{field.name}</strong><span className="block text-xs text-muted-foreground">{field.slug}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatFieldType(field.type)}</td>
                    <td className="px-4 py-3">{field.required ? <Badge tone="warning">Required</Badge> : <Badge>Optional</Badge>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{field.position + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => void reorderField(field, -1)} aria-label="Move field up"><ArrowUp className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => void reorderField(field, 1)} aria-label="Move field down"><ArrowDown className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => void removeField(field.id)} aria-label="Archive field"><Trash2 className="size-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No fields yet" description="Add fields before creating entries for this content type." />
        )}
      </Card>

      <Card>
        <SectionHeader title="Entries" description="Entries open in their own page for cleaner editing." />
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <Input placeholder="Search entries" value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} />
          <Select value={entryStatusFilter} onChange={(event) => setEntryStatusFilter(event.target.value)}>
            <option value="">All active</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Button type="button" variant="secondary" onClick={() => void loadEntries()}>Filter</Button>
        </div>
        {entries.length ? (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-surface-secondary text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Draft</th>
                  <th className="px-4 py-3 font-semibold">Published</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3"><strong>{entryTitle(entry, fields)}</strong><span className="block text-xs text-muted-foreground">{entry.id.slice(0, 8)}</span></td>
                    <td className="px-4 py-3"><EntryStatusBadge status={entry.status} /></td>
                    <td className="px-4 py-3">{entry.draftVersionId ? <Badge tone="warning">yes</Badge> : <Badge>no</Badge>}</td>
                    <td className="px-4 py-3">{entry.publishedVersionId ? <Badge tone="success">yes</Badge> : <Badge>no</Badge>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(entry.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ButtonLink href={`/content/entries/${entry.id}`} variant="secondary" size="sm"><Eye className="size-4" /> View</ButtonLink>
                        <Button type="button" variant="ghost" size="icon" onClick={() => void archiveEntry(entry.id)} aria-label="Archive entry"><Trash2 className="size-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No entries" description="Add Entry to create the first structured record." />
        )}
      </Card>

      <Sheet open={fieldOpen} title="Add Field" onClose={() => setFieldOpen(false)}>
        <form className="grid gap-4" onSubmit={addField}>
          <Field label="Name">
            <Input value={fieldForm.name} onChange={(event) => setFieldForm({ ...fieldForm, name: event.target.value })} required />
          </Field>
          <Field label="Slug">
            <Input value={fieldForm.slug} onChange={(event) => setFieldForm({ ...fieldForm, slug: event.target.value })} required />
          </Field>
          <Field label="Type">
            <Select value={fieldForm.type} onChange={(event) => setFieldForm({ ...fieldForm, type: event.target.value as ContentFieldType })}>
              {fieldTypeOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input className="size-4 rounded border-input" type="checkbox" checked={fieldForm.required} onChange={(event) => setFieldForm({ ...fieldForm, required: event.target.checked })} />
            Required field
          </label>
          <Button type="submit" disabled={isBusy}>{isBusy ? "Adding" : "Add Field"}</Button>
        </form>
      </Sheet>
    </DashboardShell>
  );
}

function Metric({ label, value, helper }: { label: string; value: number | string; helper: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <strong className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular">{value}</strong>
      <p className="text-[11.5px] text-muted-foreground">{helper}</p>
    </div>
  );
}
