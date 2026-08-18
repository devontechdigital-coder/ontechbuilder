"use client";

import { Badge } from "../../components/ui/display";
import { Field, Input, Textarea } from "../../components/ui/form";
import type { ContentEntry, ContentField, ContentFieldType } from "./types";

export const fieldTypeOptions: Array<{ value: ContentFieldType; label: string }> = [
  { value: "TEXT", label: "Text" },
  { value: "RICH_TEXT", label: "Rich text" },
  { value: "NUMBER", label: "Number" },
  { value: "BOOLEAN", label: "Boolean" },
  { value: "DATE", label: "Date" },
  { value: "IMAGE", label: "Image" },
  { value: "URL", label: "URL" },
];

export function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: ContentField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = `${field.name}${field.required ? " *" : ""}`;

  if (field.type === "RICH_TEXT") {
    return (
      <Field label={label} hint="Structured rich text is stored as text for this CMS foundation.">
        <Textarea value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }

  if (field.type === "NUMBER") {
    return (
      <Field label={label}>
        <Input type="number" value={typeof value === "number" ? String(value) : ""} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))} />
      </Field>
    );
  }

  if (field.type === "BOOLEAN") {
    return (
      <label className="flex items-center gap-2 rounded-lg border bg-surface px-4 py-3 text-sm">
        <input
          className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
    );
  }

  if (field.type === "DATE") {
    return (
      <Field label={label}>
        <Input type="date" value={typeof value === "string" ? value.slice(0, 10) : ""} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }

  if (field.type === "IMAGE") {
    return (
      <Field label={label} hint="Use an existing Media ID. The CMS stores the media reference, not a file URL.">
        <Input value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} placeholder="media-id" />
      </Field>
    );
  }

  if (field.type === "URL") {
    return (
      <Field label={label}>
        <Input type="url" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} placeholder="https://example.com" />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <Input value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function createEmptyData(fields: ContentField[]) {
  return fields.reduce<Record<string, unknown>>((data, field) => {
    data[field.slug] = field.type === "BOOLEAN" ? false : "";
    return data;
  }, {});
}

export function entryTitle(entry: ContentEntry, fields: ContentField[]) {
  const firstTextField = fields.find((field) => field.type === "TEXT" || field.type === "RICH_TEXT");
  const value = firstTextField ? entry.data[firstTextField.slug] : null;
  return typeof value === "string" && value.trim() ? value : `Entry ${entry.id.slice(0, 8)}`;
}

export function formatFieldType(type: ContentFieldType) {
  return type.toLowerCase().replace(/_/g, " ");
}

export function EntryStatusBadge({ status }: { status: ContentEntry["status"] }) {
  const tone = status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "danger" : "warning";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}
