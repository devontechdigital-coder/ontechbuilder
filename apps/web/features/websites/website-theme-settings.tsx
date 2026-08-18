"use client";

import { Palette, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Alert, Badge, Skeleton } from "../../components/ui/display";
import { Input, Select } from "../../components/ui/form";
import { ConfirmDialog, Modal, Toast } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import type { WebsiteSummary } from "./types";
import type { WebsiteTheme } from "./theme-types";

export function WebsiteThemeSettingsModal({
  tenantId,
  website,
  open,
  onClose,
}: {
  tenantId: string;
  website: WebsiteSummary;
  open: boolean;
  onClose: () => void;
}) {
  const [theme, setTheme] = useState<WebsiteTheme | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = Boolean(theme && JSON.stringify(theme.tokens) !== savedJson);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);
    setSaved(false);

    async function loadTheme() {
      try {
        const response = await apiRequest<WebsiteTheme>(`/tenants/${tenantId}/websites/${website.id}/theme`);
        if (mounted) {
          setTheme(response);
          setSavedJson(JSON.stringify(response.tokens));
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError instanceof Error ? requestError.message : "Theme could not be loaded");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTheme();
    return () => {
      mounted = false;
    };
  }, [open, tenantId, website.id]);

  function updateToken(path: string, value: string) {
    setTheme((current) => {
      if (!current) {
        return current;
      }
      const tokens = structuredClone(current.tokens);
      setDeepToken(tokens, path, value);
      return { ...current, tokens };
    });
  }

  async function saveTheme() {
    if (!theme) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await apiRequest<WebsiteTheme>(`/tenants/${tenantId}/websites/${website.id}/theme`, {
        method: "PATCH",
        body: JSON.stringify({ name: theme.name, tokens: theme.tokens }),
      });
      setTheme(response);
      setSavedJson(JSON.stringify(response.tokens));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Theme could not be saved");
    } finally {
      setIsSaving(false);
    }
  }

  async function resetTheme() {
    setConfirmReset(false);
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiRequest<WebsiteTheme>(`/tenants/${tenantId}/websites/${website.id}/theme/reset`, {
        method: "POST",
      });
      setTheme(response);
      setSavedJson(JSON.stringify(response.tokens));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Theme could not be reset");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        title={`${website.name} theme`}
        description="Edit the active WebsiteTheme record for this website."
        className="max-w-5xl"
        onClose={onClose}
      >
        <div className="grid gap-5 p-5">
          {error ? <Alert>{error}</Alert> : null}
          {isLoading || !theme ? (
            <ThemeSkeleton />
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="grid gap-4 rounded-lg border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-foreground">Colors</h3>
                    <p className="text-sm text-muted-foreground">Website-level semantic color tokens.</p>
                  </div>
                  <Badge tone={dirty ? "warning" : "success"}>{dirty ? "Unsaved" : "Saved"}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ThemeColor label="Primary" value={theme.tokens.colors.primary} onChange={(value) => updateToken("colors.primary", value)} />
                  <ThemeColor label="Primary Text" value={theme.tokens.colors.primaryForeground} onChange={(value) => updateToken("colors.primaryForeground", value)} />
                  <ThemeColor label="Secondary" value={theme.tokens.colors.secondary} onChange={(value) => updateToken("colors.secondary", value)} />
                  <ThemeColor label="Background" value={theme.tokens.colors.background} onChange={(value) => updateToken("colors.background", value)} />
                  <ThemeColor label="Foreground" value={theme.tokens.colors.foreground} onChange={(value) => updateToken("colors.foreground", value)} />
                  <ThemeColor label="Muted" value={theme.tokens.colors.muted} onChange={(value) => updateToken("colors.muted", value)} />
                  <ThemeColor label="Border" value={theme.tokens.colors.border} onChange={(value) => updateToken("colors.border", value)} />
                  <ThemeColor label="Success" value={theme.tokens.colors.success} onChange={(value) => updateToken("colors.success", value)} />
                  <ThemeColor label="Warning" value={theme.tokens.colors.warning} onChange={(value) => updateToken("colors.warning", value)} />
                  <ThemeColor label="Danger" value={theme.tokens.colors.danger} onChange={(value) => updateToken("colors.danger", value)} />
                </div>
              </section>

              <aside className="grid content-start gap-4">
                <section className="grid gap-4 rounded-lg border bg-surface p-4">
                  <h3 className="font-bold text-foreground">Typography & Layout</h3>
                  <ThemeSelect label="Heading Size" value={theme.tokens.typography.heading.fontSize} options={["2xl", "3xl", "4xl", "5xl"]} onChange={(value) => updateToken("typography.heading.fontSize", value)} />
                  <ThemeSelect label="Body Size" value={theme.tokens.typography.body.fontSize} options={["sm", "base", "lg", "xl"]} onChange={(value) => updateToken("typography.body.fontSize", value)} />
                  <ThemeInput label="Content Width" value={theme.tokens.layout.container.content} onChange={(value) => updateToken("layout.container.content", value)} />
                  <ThemeSelect label="Radius" value={theme.tokens.radius.md} options={["none", "sm", "md", "lg", "xl", "full"]} onChange={(value) => updateToken("radius.md", value)} />
                  <ThemeSelect label="Shadow" value={theme.tokens.shadows.md} options={["none", "sm", "md", "lg"]} onChange={(value) => updateToken("shadows.md", value)} />
                </section>
              </aside>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-surface px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="secondary" onClick={() => setConfirmReset(true)} disabled={isSaving || !theme}>
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button type="button" disabled={isSaving || !dirty} onClick={() => void saveTheme()}>
            {isSaving ? "Saving" : "Save theme"}
          </Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmReset}
        title="Reset website theme"
        description="Reset this website's active theme to the default tokens?"
        confirmLabel="Reset"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void resetTheme()}
      />
      {saved ? <Toast>Theme saved.</Toast> : null}
    </>
  );
}

export function ThemeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick}>
      <Palette className="size-4" />
      Theme
    </Button>
  );
}

function ThemeColor({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      <span className="grid grid-cols-[44px_minmax(0,1fr)] gap-2 rounded-lg border bg-surface-secondary/40 p-2">
        <input className="h-10 w-full rounded-md border bg-surface p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function ThemeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ThemeSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
    </label>
  );
}

function ThemeSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Skeleton className="h-96 rounded-lg" />
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

function setDeepToken(tokens: WebsiteTheme["tokens"], path: string, value: string) {
  const parts = path.split(".");
  let current: unknown = tokens;
  for (const part of parts.slice(0, -1)) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return;
    }
    current = (current as Record<string, unknown>)[part];
  }
  const last = parts[parts.length - 1];
  if (last && typeof current === "object" && current !== null && !Array.isArray(current) && last in current) {
    (current as Record<string, string>)[last] = value;
  }
}
