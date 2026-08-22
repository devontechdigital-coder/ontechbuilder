"use client";

import { ImageIcon, Search, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Alert, Badge, Skeleton } from "../../components/ui/display";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { Modal, Toast } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import type { PageSeoSettings, PageSummary, WebsiteSummary } from "./types";

const defaultSeoSettings: PageSeoSettings = {
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  canonicalEnabled: false,
  canonicalUrl: "",
  redirectEnabled: false,
  redirectUrl: "",
  redirectType: "301",
  indexing: "index",
  linkFollowing: "follow",
  includeInSitemap: true,
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  twitterTitle: "",
  twitterDescription: "",
  twitterImage: "",
  structuredData: "",
  headCode: "",
  bodyCode: "",
  footerCode: "",
};

export function PageSeoSettingsModal({
  page,
  website,
  open,
  onClose,
  endpointBase = "pages",
}: {
  page: PageSummary | null;
  website: WebsiteSummary;
  open: boolean;
  onClose: () => void;
  endpointBase?: "pages" | "blogs";
}) {
  const [seo, setSeo] = useState<PageSeoSettings>(defaultSeoSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pageUrl = useMemo(() => {
    if (!page) {
      return "";
    }

    return `https://${website.slug}.stackbuilder.site/${page.slug}`;
  }, [page, website.slug]);

  useEffect(() => {
    if (!open || !page) {
      return;
    }

    const currentPage = page;
    let mounted = true;
    setIsLoading(true);
    setError(null);
    setSaved(false);

    async function loadSeo() {
      try {
        const response = await apiRequest<PageSeoSettings>(`/${endpointBase}/${currentPage.id}/seo`);
        if (mounted) {
          setSeo({ ...defaultSeoSettings, ...response });
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : "SEO settings could not be loaded");
          setSeo(defaultSeoSettings);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSeo();

    return () => {
      mounted = false;
    };
  }, [endpointBase, open, page]);

  function update<K extends keyof PageSeoSettings>(key: K, value: PageSeoSettings[K]) {
    setSeo((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!page) {
      return;
    }

    const validationError = validateSeo(seo);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await apiRequest<PageSeoSettings>(`/${endpointBase}/${page.id}/seo`, {
        method: "PATCH",
        body: JSON.stringify({ seo }),
      });
      setSeo({ ...defaultSeoSettings, ...response });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "SEO settings could not be saved");
    } finally {
      setIsSaving(false);
    }
  }

  if (!page) {
    return null;
  }

  return (
    <>
      <Modal
        open={open}
        title={`SEO settings: ${page.title}`}
        description="Configure search, social previews, structured data, and custom code for this page."
        className="max-w-6xl"
        onClose={onClose}
      >
        {isLoading ? (
          <div className="p-5">
            <ModalSkeleton />
          </div>
        ) : (
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-5">
              {error ? <Alert>{error}</Alert> : null}

              <SeoSection title="Basic SEO" description="The primary metadata used by search engines.">
                <Field
                  label="Meta Title"
                  hint={`Recommended 50-60 characters. Current: ${seo.metaTitle.length}`}
                  {...fieldError(lengthHint(seo.metaTitle.length, 50, 60))}
                >
                  <Input value={seo.metaTitle} onChange={(event) => update("metaTitle", event.target.value)} />
                </Field>
                <Field
                  label="Meta Description"
                  hint={`Recommended 150-160 characters. Current: ${seo.metaDescription.length}`}
                  {...fieldError(lengthHint(seo.metaDescription.length, 150, 160))}
                >
                  <Textarea value={seo.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} />
                </Field>
                <Field label="Meta Keywords" hint="Optional. Keep keywords comma separated if you use them.">
                  <Input value={seo.metaKeywords} onChange={(event) => update("metaKeywords", event.target.value)} />
                </Field>
                <SwitchCard
                  title="Custom Canonical"
                  description="Override the default canonical URL for this page."
                  checked={seo.canonicalEnabled}
                  onChange={(checked) => update("canonicalEnabled", checked)}
                >
                  {seo.canonicalEnabled ? (
                    <Field label="Canonical URL">
                      <Input value={seo.canonicalUrl} onChange={(event) => update("canonicalUrl", event.target.value)} placeholder={pageUrl} />
                    </Field>
                  ) : null}
                </SwitchCard>
                <SwitchCard
                  title="Redirection"
                  description="Send visitors and crawlers to a different URL."
                  checked={seo.redirectEnabled}
                  onChange={(checked) => update("redirectEnabled", checked)}
                >
                  {seo.redirectEnabled ? (
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                      <Field label="Redirect URL">
                        <Input value={seo.redirectUrl} onChange={(event) => update("redirectUrl", event.target.value)} />
                      </Field>
                      <Field label="Redirect Type">
                        <Select value={seo.redirectType} onChange={(event) => update("redirectType", event.target.value as PageSeoSettings["redirectType"])}>
                          <option value="301">301</option>
                          <option value="302">302</option>
                        </Select>
                      </Field>
                    </div>
                  ) : null}
                </SwitchCard>
              </SeoSection>

              <SeoSection title="Search Engine Settings" description="Control indexing and crawler behavior.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Indexing">
                    <Select value={seo.indexing} onChange={(event) => update("indexing", event.target.value as PageSeoSettings["indexing"])}>
                      <option value="index">Index</option>
                      <option value="noindex">Noindex</option>
                    </Select>
                  </Field>
                  <Field label="Link Following">
                    <Select value={seo.linkFollowing} onChange={(event) => update("linkFollowing", event.target.value as PageSeoSettings["linkFollowing"])}>
                      <option value="follow">Follow</option>
                      <option value="nofollow">Nofollow</option>
                    </Select>
                  </Field>
                </div>
                <SwitchCard
                  title="Include in Sitemap"
                  description="Allow this page to appear in sitemap exports and discovery flows."
                  checked={seo.includeInSitemap}
                  onChange={(checked) => update("includeInSitemap", checked)}
                />
              </SeoSection>

              <SeoSection title="Social / Open Graph" description="Tune rich previews for social networks and messaging apps.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="OG Title">
                    <Input value={seo.ogTitle} onChange={(event) => update("ogTitle", event.target.value)} />
                  </Field>
                  <Field label="Twitter/X Title">
                    <Input value={seo.twitterTitle} onChange={(event) => update("twitterTitle", event.target.value)} />
                  </Field>
                  <Field label="OG Description">
                    <Textarea value={seo.ogDescription} onChange={(event) => update("ogDescription", event.target.value)} />
                  </Field>
                  <Field label="Twitter/X Description">
                    <Textarea value={seo.twitterDescription} onChange={(event) => update("twitterDescription", event.target.value)} />
                  </Field>
                  <ImageField label="OG Image" value={seo.ogImage} onChange={(value) => update("ogImage", value)} />
                  <ImageField label="Twitter/X Image" value={seo.twitterImage} onChange={(value) => update("twitterImage", value)} />
                </div>
              </SeoSection>
              <SeoSection title="Structured Data" description="Paste custom JSON-LD schema markup.">
                <Field label="Custom JSON-LD / Schema markup">
                  <Textarea
                    className="min-h-48 font-mono text-xs"
                    value={seo.structuredData}
                    onChange={(event) => update("structuredData", event.target.value)}
                    spellCheck={false}
                    placeholder='{"@context":"https://schema.org","@type":"WebPage"}'
                  />
                </Field>
              </SeoSection>

              <SeoSection title="Custom Code" description="Inject page-specific code into key template locations.">
                <Field label="Head Code">
                  <Textarea className="min-h-36 font-mono text-xs" value={seo.headCode} onChange={(event) => update("headCode", event.target.value)} spellCheck={false} />
                </Field>
                <Field label="Body Code">
                  <Textarea className="min-h-36 font-mono text-xs" value={seo.bodyCode} onChange={(event) => update("bodyCode", event.target.value)} spellCheck={false} />
                </Field>
                <Field label="Footer Code">
                  <Textarea className="min-h-36 font-mono text-xs" value={seo.footerCode} onChange={(event) => update("footerCode", event.target.value)} spellCheck={false} />
                </Field>
              </SeoSection>
            </div>

            <aside className="grid content-start gap-4">
              <GooglePreview title={seo.metaTitle || page.title} url={pageUrl} description={seo.metaDescription} />
              <div className="grid gap-3 rounded-lg border bg-surface-secondary/40 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-bold text-foreground">SEO checks</h3>
                </div>
                <CheckRow label="Title length" ok={seo.metaTitle.length >= 50 && seo.metaTitle.length <= 60} />
                <CheckRow label="Description length" ok={seo.metaDescription.length >= 150 && seo.metaDescription.length <= 160} />
                <CheckRow label="Indexable" ok={seo.indexing === "index"} />
                <CheckRow label="In sitemap" ok={seo.includeInSitemap} />
              </div>
            </aside>
          </div>
        )}

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-surface px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={isSaving || isLoading} onClick={() => void save()}>
            {isSaving ? "Saving" : "Save Changes"}
          </Button>
        </div>
      </Modal>
      {saved ? <Toast>SEO settings saved.</Toast> : null}
    </>
  );
}

function SeoSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border bg-surface p-4">
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SwitchCard({
  title,
  description,
  checked,
  children,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  children?: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={`grid gap-3 rounded-lg border p-3 transition-colors ${
        checked ? "border-primary/30 bg-primary/5" : "bg-surface-secondary/50 hover:bg-surface-secondary"
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={() => onChange(!checked)}
      >
        <span className="grid gap-1">
          <span className="font-semibold text-foreground">{title}</span>
          <span className="text-sm leading-5 text-muted-foreground">{description}</span>
        </span>
        <span
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
            checked ? "border-primary bg-primary" : "border-input bg-muted"
          }`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </span>
      </button>
      {children ? <div className="border-t pt-3">{children}</div> : null}
    </div>
  );
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} hint="Paste an image URL or select/upload from media when connected.">
      <div className="grid gap-2 rounded-lg border bg-surface-secondary/40 p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-surface">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
          <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://..." />
        </div>
        <Input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            const reader = new FileReader();
            reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : value);
            reader.readAsDataURL(file);
          }}
        />
      </div>
    </Field>
  );
}

function GooglePreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <section className="grid gap-3 rounded-lg border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-foreground">Google Search Preview</h3>
        <Badge tone="info">Live</Badge>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
            <Search className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{new URLSafe(url).hostname}</p>
            <p className="truncate text-xs text-muted-foreground">{url}</p>
          </div>
        </div>
        <p className="line-clamp-2 text-xl text-[#1a0dab]">{title || "Page title"}</p>
        <p className="mt-1 line-clamp-3 text-sm leading-6 text-[#4d5156]">
          {description || "Meta description will appear here as you type."}
        </p>
      </div>
    </section>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-surface px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? "font-semibold text-success" : "font-semibold text-warning"}>{ok ? "Good" : "Review"}</span>
    </div>
  );
}

function ModalSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <section key={`seo-skeleton-${index}`} className="grid gap-4 rounded-lg border bg-surface p-4">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-11 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </section>
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

function lengthHint(length: number, min: number, max: number) {
  if (!length) {
    return undefined;
  }

  if (length < min) {
    return `Short by ${min - length} characters`;
  }

  if (length > max) {
    return `Long by ${length - max} characters`;
  }

  return undefined;
}

function fieldError(error: string | undefined) {
  return error ? { error } : {};
}

function validateSeo(seo: PageSeoSettings) {
  if (seo.canonicalEnabled && !seo.canonicalUrl.trim()) {
    return "Canonical URL is required when custom canonical is enabled.";
  }

  if (seo.redirectEnabled && !seo.redirectUrl.trim()) {
    return "Redirect URL is required when redirection is enabled.";
  }

  if (seo.structuredData.trim()) {
    try {
      JSON.parse(seo.structuredData);
    } catch {
      return "Structured data must be valid JSON-LD.";
    }
  }

  return null;
}

class URLSafe {
  private readonly value: URL | null;

  constructor(url: string) {
    try {
      this.value = new URL(url);
    } catch {
      this.value = null;
    }
  }

  get hostname() {
    return this.value?.hostname ?? "example.com";
  }
}
