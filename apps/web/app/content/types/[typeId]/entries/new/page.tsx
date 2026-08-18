"use client";

import { FileText } from "lucide-react";
import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "../../../../../../components/layout/dashboard-shell";
import { Button, ButtonLink } from "../../../../../../components/ui/button";
import { Alert, Card, EmptyState, LoadingState, SectionHeader } from "../../../../../../components/ui/display";
import { apiRequest } from "../../../../../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../../../../../features/auth/types";
import type { ContentEntry, ContentTypeSummary } from "../../../../../../features/cms/types";
import { FieldRenderer, createEmptyData } from "../../../../../../features/cms/field-renderer";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

interface NewEntryPageProps {
  params: Promise<{ typeId: string }>;
}

export default function NewEntryPage({ params }: NewEntryPageProps) {
  const { typeId } = use(params);
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [contentType, setContentType] = useState<ContentTypeSummary | null>(null);
  const [entryData, setEntryData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse, typeResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
          apiRequest<ContentTypeSummary>(`/content-types/${typeId}`),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);
        setContentType(typeResponse);
        setEntryData(createEmptyData(typeResponse.fields ?? []));
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

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const saved = await apiRequest<ContentEntry>(`/content-types/${typeId}/entries`, {
        method: "POST",
        body: JSON.stringify({ data: entryData }),
      });
      router.push(`/content/entries/${saved.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Entry creation failed");
    } finally {
      setIsSaving(false);
    }
  }

  if (!me || !contentType) {
    return <LoadingState label="Loading entry editor" />;
  }

  const fields = contentType.fields ?? [];

  return (
    <DashboardShell
      title="New Entry"
      eyebrow={contentType.name}
      description="Create a structured content entry from this content type's field definitions."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Content", href: "/content" }, { label: contentType.name, href: `/content/types/${contentType.id}` }, { label: "New Entry" }]}
      onTenantChange={switchTenant}
      actions={<ButtonLink href={`/content/types/${contentType.id}`} variant="secondary">Back</ButtonLink>}
    >
      {error ? <Alert>{error}</Alert> : null}
      <Card>
        <SectionHeader title="Entry fields" description="This form is generated dynamically. No CMS fields are hardcoded." />
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
          <EmptyState title="No fields configured" description="Add fields to this content type before creating entries." />
        )}
      </Card>
    </DashboardShell>
  );
}
