"use client";

import { ImageIcon, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button } from "../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader } from "../../components/ui/display";
import { Field, Input, Select } from "../../components/ui/form";
import { ConfirmDialog } from "../../components/ui/overlay";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../features/auth/types";
import type { MediaAccessResponse, MediaSummary, MediaUploadInitResponse, PageResult } from "../../features/media/types";
import { apiRequest } from "../../lib/api";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const maxImageBytes = 10_000_000;
const maxFileBytes = 20_000_000;

export default function MediaPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [query, setQuery] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<MediaSummary | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaSummary | null>(null);

  const imageCount = useMemo(() => items.filter((item) => item.mimeType.startsWith("image/")).length, [items]);

  async function loadMedia(options?: { cursor?: string | null; append?: boolean }) {
    const params = new URLSearchParams();
    params.set("limit", "24");
    if (query.trim()) {
      params.set("query", query.trim());
    }
    if (mimeType) {
      params.set("mimeType", mimeType);
    }
    if (options?.cursor) {
      params.set("cursor", options.cursor);
    }

    const response = await apiRequest<PageResult<MediaSummary>>(`/media?${params.toString()}`);
    setItems((current) => (options?.append ? [...current, ...response.data] : response.data));
    setNextCursor(response.nextCursor);
  }

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);
        await loadMedia();
      } catch {
        router.push("/login");
      }
    }

    void load();
  }, [router]);

  useEffect(() => {
    if (!me) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadMedia().catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Media loading failed");
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, mimeType, me]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    setSelected(null);
    setPreviewUrl(null);
    await loadMedia();
  }

  async function handleFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) {
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const init = await apiRequest<MediaUploadInitResponse>("/media/uploads/init", {
        method: "POST",
        body: JSON.stringify({
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          access: "PRIVATE",
        }),
      });

      const uploadResponse = await fetch(init.upload.url, {
        method: init.upload.method,
        headers: init.upload.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload to storage failed");
      }

      await apiRequest<MediaSummary>(`/media/uploads/${init.mediaId}/complete`, {
        method: "POST",
        body: JSON.stringify({ uploadToken: init.uploadToken }),
      });

      await loadMedia();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function openPreview(item: MediaSummary) {
    setSelected(item);
    setPreviewUrl(null);
    try {
      const response = await apiRequest<MediaAccessResponse>(`/media/${item.id}/access`);
      setPreviewUrl(response.url);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Preview failed");
    }
  }

  async function deleteMedia() {
    if (!deleteTarget) {
      return;
    }

    try {
      await apiRequest(`/media/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
        setPreviewUrl(null);
      }
      await loadMedia();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Delete failed");
    }
  }

  if (!me) {
    return <LoadingState label="Loading media library" />;
  }

  return (
    <DashboardShell
      title="Media library"
      eyebrow="Build"
      description="Upload and manage tenant-owned images and files stored in Google Cloud Storage."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Media" }]}
      onTenantChange={switchTenant}
    >
      {error ? <Alert>{error}</Alert> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <Metric label="Total media" value={items.length} helper="Loaded from the current tenant page." />
        </Card>
        <Card>
          <Metric label="Images" value={imageCount} helper="JPEG, PNG, WebP, and GIF assets." />
        </Card>
        <Card>
          <Metric label="Access" value={items.filter((item) => item.access === "PRIVATE").length} helper="Private media records loaded." />
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]">
        <Card>
          <SectionHeader
            title="Upload"
            description="Files upload directly to storage with a short-lived authorization."
          />
          <label
            className={`grid cursor-pointer justify-items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? "border-primary bg-primary/10" : "bg-surface-secondary/40 hover:bg-surface-secondary"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event: DragEvent<HTMLLabelElement>) => {
              event.preventDefault();
              setDragging(false);
              void handleFiles(event.dataTransfer.files);
            }}
          >
            <UploadCloud className="size-8 text-primary" />
            <span className="font-semibold text-foreground">
              {uploading ? "Uploading..." : "Drop a file or choose one"}
            </span>
            <span className="max-w-sm text-sm leading-6 text-muted-foreground">
              Images up to 10 MB. PDFs up to 20 MB. SVG and executable files are not allowed.
            </span>
            <input
              className="sr-only"
              type="file"
              accept={allowedTypes.join(",")}
              disabled={uploading}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                if (event.target.files) {
                  void handleFiles(event.target.files);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Uploading to storage and finalizing metadata
            </div>
          ) : null}
        </Card>

        <Card>
          <SectionHeader title="Find media" description="Search and filter using PostgreSQL-backed media metadata." />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <Field label="Search filename">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="hero, logo, brochure" />
            </Field>
            <Field label="Type">
              <Select value={mimeType} onChange={(event) => setMimeType(event.target.value)}>
                <option value="">All</option>
                <option value="image">Images</option>
                <option value="application/pdf">PDFs</option>
              </Select>
            </Field>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Assets" eyebrow="Library" action={nextCursor ? <Badge tone="info">More available</Badge> : null}>
          {items.length ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`grid overflow-hidden rounded-xl border bg-surface text-left transition-colors hover:bg-surface-secondary ${
                      selected?.id === item.id ? "ring-2 ring-primary" : ""
                    }`}
                    type="button"
                    onClick={() => void openPreview(item)}
                  >
                    <div className="grid aspect-[4/3] place-items-center bg-surface-secondary">
                      {item.mimeType.startsWith("image/") ? (
                        <ImageIcon className="size-9 text-primary" />
                      ) : (
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-info shadow-sm">PDF</span>
                      )}
                    </div>
                    <div className="grid gap-2 p-3">
                      <div>
                        <strong className="line-clamp-1 text-sm text-foreground">{item.originalFilename}</strong>
                        <p className="text-xs text-muted-foreground">{item.mimeType}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={item.access === "PRIVATE" ? "neutral" : "info"}>{item.access.toLowerCase()}</Badge>
                        <Badge tone="success">{formatBytes(item.sizeBytes)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.width && item.height ? `${item.width} x ${item.height} / ` : ""}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {nextCursor ? (
                <div className="flex justify-center">
                  <Button type="button" variant="secondary" onClick={() => loadMedia({ cursor: nextCursor, append: true })}>
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No media yet"
              description="Upload an image or file to create the first tenant-owned media record."
            />
          )}
        </Card>

        <Card title="Preview" eyebrow="Selected asset">
          {selected ? (
            <div className="grid gap-4">
              <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border bg-surface-secondary">
                {previewUrl && selected.mimeType.startsWith("image/") ? (
                  <img alt={selected.originalFilename} className="h-full w-full object-contain" src={previewUrl} />
                ) : (
                  <ImageIcon className="size-10 text-primary" />
                )}
              </div>
              <div className="grid gap-2 text-sm">
                <Detail label="Filename" value={selected.originalFilename} />
                <Detail label="Type" value={selected.mimeType} />
                <Detail label="Size" value={formatBytes(selected.sizeBytes)} />
                <Detail label="Dimensions" value={selected.width && selected.height ? `${selected.width} x ${selected.height}` : "Not available"} />
                <Detail label="Uploaded" value={new Date(selected.createdAt).toLocaleString()} />
              </div>
              <div className="flex flex-wrap gap-2">
                {previewUrl ? (
                  <Button asChild variant="secondary">
                    <a href={previewUrl} rel="noreferrer" target="_blank">Open</a>
                  </Button>
                ) : null}
                <Button type="button" variant="danger" onClick={() => setDeleteTarget(selected)}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState title="Select media" description="Choose an asset from the library to preview metadata and actions." />
          )}
        </Card>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete media"
        description={deleteTarget ? `Delete ${deleteTarget.originalFilename}? This removes the storage object and metadata row.` : ""}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteMedia()}
      />
    </DashboardShell>
  );
}

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <strong className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular">{value}</strong>
      <p className="text-[11.5px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="break-words text-foreground">{value}</strong>
    </div>
  );
}

function validateFile(file: File): string | null {
  if (!allowedTypes.includes(file.type)) {
    return "This file type is not allowed.";
  }

  const limit = file.type.startsWith("image/") ? maxImageBytes : maxFileBytes;
  if (file.size > limit) {
    return file.type.startsWith("image/")
      ? "Image exceeds the 10 MB limit."
      : "File exceeds the 20 MB limit.";
  }

  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
