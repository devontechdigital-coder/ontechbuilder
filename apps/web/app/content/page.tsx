"use client";

import { Eye, Plus, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button, ButtonLink } from "../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader } from "../../components/ui/display";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { Sheet } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../features/auth/types";
import type { PageResult, WebsiteSummary } from "../../features/websites/types";
import type { ContentTypeSummary } from "../../features/cms/types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

export default function ContentPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [websites, setWebsites] = useState<WebsiteSummary[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState("");
  const [contentTypes, setContentTypes] = useState<ContentTypeSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);

        if (meResponse.activeTenant) {
          const websiteResponse = await apiRequest<PageResult<WebsiteSummary>>(
            `/tenants/${meResponse.activeTenant.id}/websites?limit=50`,
          );
          setWebsites(websiteResponse.data);
          const firstWebsiteId = websiteResponse.data[0]?.id ?? "";
          setSelectedWebsiteId(firstWebsiteId);
          if (firstWebsiteId) {
            await loadContentTypes(firstWebsiteId);
          }
        }
      } catch {
        router.push("/login");
      }
    }

    void load();
  }, [router]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    const websiteResponse = await apiRequest<PageResult<WebsiteSummary>>(
      `/tenants/${response.activeTenant.id}/websites?limit=50`,
    );
    setWebsites(websiteResponse.data);
    const firstWebsiteId = websiteResponse.data[0]?.id ?? "";
    setSelectedWebsiteId(firstWebsiteId);
    await loadContentTypes(firstWebsiteId);
  }

  async function loadContentTypes(websiteId = selectedWebsiteId) {
    if (!websiteId) {
      setContentTypes([]);
      return;
    }
    const response = await apiRequest<PageResult<ContentTypeSummary>>(
      `/websites/${websiteId}/content-types?limit=50`,
    );
    setContentTypes(response.data);
  }

  async function createContentType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWebsiteId) {
      setError("Create a website before adding content types.");
      return;
    }

    setError(null);
    setMessage(null);
    setIsBusy(true);
    try {
      await apiRequest(`/websites/${selectedWebsiteId}/content-types`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", slug: "", description: "" });
      setCreateOpen(false);
      await loadContentTypes(selectedWebsiteId);
      setMessage("Content type created.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Content type creation failed");
    } finally {
      setIsBusy(false);
    }
  }

  if (!me) {
    return <LoadingState label="Loading content" />;
  }

  return (
    <DashboardShell
      title="Content"
      eyebrow="CMS"
      description="Manage structured content types and open each collection in its own workspace."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Content" }]}
      onTenantChange={switchTenant}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={() => void loadContentTypes()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Add Content
          </Button>
        </>
      }
    >
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <SectionHeader title="Content types" description="Collections are tenant-safe and scoped to the selected website." />
        <div className="max-w-md">
          <Field label="Website">
            <Select
              value={selectedWebsiteId}
              onChange={(event) => {
                setSelectedWebsiteId(event.target.value);
                void loadContentTypes(event.target.value);
              }}
            >
              {websites.map((website) => (
                <option key={website.id} value={website.id}>
                  {website.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {contentTypes.length ? (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-surface-secondary text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Slug</th>
                  <th className="px-4 py-3 font-semibold">Fields</th>
                  <th className="px-4 py-3 font-semibold">Entries</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contentTypes.map((contentType) => (
                  <tr key={contentType.id} className="bg-surface">
                    <td className="px-4 py-3">
                      <div className="grid gap-1">
                        <strong className="text-foreground">{contentType.name}</strong>
                        <span className="text-xs text-muted-foreground">{contentType.description || "No description"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{contentType.slug}</td>
                    <td className="px-4 py-3"><Badge tone="info">{contentType._count?.fields ?? 0}</Badge></td>
                    <td className="px-4 py-3"><Badge tone="neutral">{contentType._count?.entries ?? 0}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(contentType.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ButtonLink href={`/content/types/${contentType.id}`} variant="secondary" size="sm">
                          <Eye className="size-4" />
                          View
                        </ButtonLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No content types" description="Add Content to create a structured CMS collection for this website." />
        )}
      </Card>

      <Sheet open={createOpen} title="Add Content" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-4" onSubmit={createContentType}>
          <Field label="Name">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Slug">
            <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Button type="submit" disabled={isBusy}>
            {isBusy ? "Creating" : "Create Content"}
          </Button>
        </form>
      </Sheet>
    </DashboardShell>
  );
}
