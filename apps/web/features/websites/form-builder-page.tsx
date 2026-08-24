"use client";

import {
  AlignLeft,
  ArrowLeft,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  Circle,
  ClipboardList,
  Clock,
  EyeOff,
  GripVertical,
  Hash,
  HelpCircle,
  LayoutGrid,
  Link as LinkIcon,
  Lock,
  Mail,
  MousePointerClick,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState, type ComponentType } from "react";
import toast from "react-hot-toast";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button, IconButton } from "../../components/ui/button";
import { Alert, Badge, Card, LoadingState } from "../../components/ui/display";
import { Checkbox, Field, Input, Select, Textarea } from "../../components/ui/form";
import { Modal } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import { FORM_FIELD_TYPES, type FormField, type FormFieldOption, type FormFieldType, type FormMailSettings, type FormSummary, type WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

function getCachedDashboardShell(): { me: MeResponse; tenants: TenantSummary[] } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem("stackbuilder-dashboard-shell-state") ?? "null") as {
      me: MeResponse;
      tenants: TenantSummary[];
    } | null;
  } catch {
    return null;
  }
}

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function slugifyName(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "field";
}

function uniqueFieldName(base: string, fields: FormField[], skipId?: string) {
  const taken = new Set(fields.filter((field) => field.id !== skipId).map((field) => field.name));
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 500; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${createId()}`;
}

interface FieldMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
}

const FIELD_TYPE_META: Record<FormFieldType, FieldMeta> = {
  text: { label: "Text", icon: Type, group: "Basic" },
  email: { label: "Email", icon: Mail, group: "Basic" },
  url: { label: "URL", icon: LinkIcon, group: "Basic" },
  tel: { label: "Telephone", icon: Phone, group: "Basic" },
  number: { label: "Number", icon: Hash, group: "Basic" },
  textarea: { label: "Text Area", icon: AlignLeft, group: "Basic" },
  password: { label: "Password", icon: Lock, group: "Basic" },
  search: { label: "Search", icon: Search, group: "Basic" },
  date: { label: "Date", icon: Calendar, group: "Date & Time" },
  time: { label: "Time", icon: Clock, group: "Date & Time" },
  "datetime-local": { label: "Date and Time", icon: CalendarClock, group: "Date & Time" },
  month: { label: "Month", icon: CalendarDays, group: "Date & Time" },
  week: { label: "Week", icon: CalendarRange, group: "Date & Time" },
  select: { label: "Drop-down Menu", icon: ChevronDown, group: "Choice" },
  checkbox: { label: "Checkboxes", icon: CheckSquare, group: "Choice" },
  radio: { label: "Radio Buttons", icon: Circle, group: "Choice" },
  acceptance: { label: "Acceptance", icon: ShieldCheck, group: "Choice" },
  quiz: { label: "Quiz", icon: HelpCircle, group: "Choice" },
  file: { label: "File Upload", icon: Upload, group: "Advanced" },
  hidden: { label: "Hidden Field", icon: EyeOff, group: "Advanced" },
  range: { label: "Range / Slider", icon: SlidersHorizontal, group: "Advanced" },
  submit: { label: "Submit Button", icon: Send, group: "Buttons" },
  reset: { label: "Reset Button", icon: RotateCcw, group: "Buttons" },
  button: { label: "Regular Button", icon: MousePointerClick, group: "Buttons" },
};

const FIELD_GROUPS = ["Basic", "Choice", "Date & Time", "Advanced", "Buttons"];

const TEXT_LIKE: ReadonlySet<FormFieldType> = new Set(["text", "email", "url", "tel", "password", "search"]);
const OPTIONS_TYPES: ReadonlySet<FormFieldType> = new Set(["select", "radio", "checkbox", "quiz"]);
const BUTTON_TYPES: ReadonlySet<FormFieldType> = new Set(["submit", "reset", "button"]);

function supportsPlaceholder(type: FormFieldType) {
  return TEXT_LIKE.has(type) || type === "textarea" || type === "number";
}
function supportsRequired(type: FormFieldType) {
  return !BUTTON_TYPES.has(type) && type !== "hidden";
}
function supportsDefaultValue(type: FormFieldType) {
  return !BUTTON_TYPES.has(type) && type !== "file" && type !== "checkbox" && type !== "acceptance";
}
function supportsHelpText(type: FormFieldType) {
  return !BUTTON_TYPES.has(type) && type !== "hidden";
}
function supportsOptions(type: FormFieldType) {
  return OPTIONS_TYPES.has(type);
}
function supportsMinMaxStep(type: FormFieldType) {
  return type === "number" || type === "range";
}
function supportsMinMaxLength(type: FormFieldType) {
  return TEXT_LIKE.has(type) || type === "textarea";
}
function supportsPattern(type: FormFieldType) {
  return TEXT_LIKE.has(type) && type !== "password";
}
function supportsAcceptedFileTypes(type: FormFieldType) {
  return type === "file";
}
function supportsQuizAnswer(type: FormFieldType) {
  return type === "quiz";
}
function supportsRows(type: FormFieldType) {
  return type === "textarea";
}

function createField(type: FormFieldType, fields: FormField[]): FormField {
  const meta = FIELD_TYPE_META[type];
  const label = BUTTON_TYPES.has(type) ? meta.label : `New ${meta.label}`;
  const field: FormField = {
    id: createId(),
    type,
    label,
    name: uniqueFieldName(slugifyName(meta.label), fields),
  };
  if (supportsRequired(type) && (type === "acceptance" || type === "quiz")) field.required = true;
  if (supportsOptions(type)) {
    field.options = [
      { label: "Option 1", value: "option-1" },
      { label: "Option 2", value: "option-2" },
    ];
  }
  if (type === "quiz") field.quizAnswer = "option-1";
  if (type === "range") {
    field.min = 0;
    field.max = 100;
    field.step = 1;
    field.defaultValue = "50";
  }
  if (type === "textarea") field.rows = 4;
  if (BUTTON_TYPES.has(type)) field.label = type === "submit" ? "Submit" : type === "reset" ? "Reset" : "Button";
  return field;
}

function fieldIcon(type: FormFieldType) {
  const Icon = FIELD_TYPE_META[type].icon;
  return <Icon className="size-4" />;
}

/** An empty slot has no field yet — it only exists in the browser's canvas state until picked/dropped in. */
type SlotItem = { kind: "field"; field: FormField } | { kind: "empty"; width: number };
interface LayoutRow {
  id: string;
  items: SlotItem[];
}

const LAYOUT_PRESETS: Array<{ id: string; label: string; widths: number[] }> = [
  { id: "1", label: "1 column", widths: [100] },
  { id: "2-eq", label: "2 columns", widths: [50, 50] },
  { id: "3-eq", label: "3 columns", widths: [34, 33, 33] },
  { id: "4-eq", label: "4 columns", widths: [25, 25, 25, 25] },
  { id: "1-3", label: "1/3 + 2/3", widths: [33, 67] },
  { id: "2-3", label: "2/3 + 1/3", widths: [67, 33] },
];

const WIDTH_PRESETS = [
  { value: 100, label: "Full width (100%)" },
  { value: 75, label: "Three quarters (75%)" },
  { value: 67, label: "Two thirds (67%)" },
  { value: 50, label: "Half (50%)" },
  { value: 34, label: "One third (34%)" },
  { value: 25, label: "One quarter (25%)" },
];

/**
 * Rebuilds rows/columns from the flat, saved field list using each field's own row/column
 * metadata. Fields saved before this layout feature existed (or added via a plain click, which
 * still just appends a solo full-width row) have no row metadata — those fall back to one row
 * per field so older forms keep rendering exactly as a flat list.
 */
function deserializeFields(fields: FormField[]): LayoutRow[] {
  if (!fields.length) return [];
  if (!fields.every((field) => typeof field.row === "number")) {
    return fields.map((field) => ({
      id: createId(),
      items: [{ kind: "field", field: { ...field, width: field.width ?? 100 } }],
    }));
  }

  const byRow = new Map<number, FormField[]>();
  for (const field of fields) {
    const rowIndex = field.row ?? 0;
    const bucket = byRow.get(rowIndex);
    if (bucket) bucket.push(field);
    else byRow.set(rowIndex, [field]);
  }

  return [...byRow.keys()]
    .sort((a, b) => a - b)
    .map((rowIndex) => ({
      id: createId(),
      items: (byRow.get(rowIndex) ?? [])
        .slice()
        .sort((a, b) => (a.column ?? 0) - (b.column ?? 0))
        .map((field) => ({ kind: "field" as const, field })),
    }));
}

function serializeRows(rows: LayoutRow[]): FormField[] {
  const result: FormField[] = [];
  rows.forEach((row, rowIndex) => {
    row.items.forEach((item, columnIndex) => {
      if (item.kind !== "field") return;
      result.push({
        ...item.field,
        row: rowIndex,
        column: columnIndex,
        width: item.field.width ?? Math.round(100 / row.items.length),
      });
    });
  });
  return result;
}

function flattenRows(rows: LayoutRow[]): FormField[] {
  return rows.flatMap((row) => row.items.filter((item): item is Extract<SlotItem, { kind: "field" }> => item.kind === "field").map((item) => item.field));
}

/**
 * Full drag-and-drop form builder: a "Form" tab (field-type palette + reorderable canvas + a
 * per-field settings panel) and a "Mail" tab (notification To/From/headers + a customizable
 * {{field_name}}-templated HTML subject/body, mirroring how forms.service.ts's renderMailTemplate
 * substitutes submitted values server-side).
 */
export function FormBuilderPage({ params }: { params: Promise<{ id: string; formId: string }> }) {
  const { id, formId } = use(params);
  const router = useRouter();
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [form, setForm] = useState<FormSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "mail">("form");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<FormSummary["status"]>("DRAFT");
  const [rows, setRows] = useState<LayoutRow[]>([]);
  const [mailSettings, setMailSettings] = useState<FormMailSettings>({
    enabled: false,
    to: "",
    from: "",
    additionalHeaders: "",
    subject: "New form submission",
    bodyHtml: "<p>You received a new submission.</p>",
  });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [draggingPaletteType, setDraggingPaletteType] = useState<FormFieldType | null>(null);
  const [movingItem, setMovingItem] = useState<{ rowIndex: number; itemIndex: number } | null>(null);
  const [draggingRowIndex, setDraggingRowIndex] = useState<number | null>(null);
  const [rowOverIndex, setRowOverIndex] = useState<number | null>(null);

  async function loadForm(activeTenant: ActiveTenant) {
    setError(null);
    try {
      const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
      setWebsite(websiteResponse);

      const formResponse = await apiRequest<FormSummary>(`/forms/${formId}`);
      setForm(formResponse);
      setName(formResponse.name);
      setSlug(formResponse.slug);
      setStatus(formResponse.status);
      setRows(deserializeFields(formResponse.fields));
      setMailSettings(formResponse.mailSettings);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Form failed to load");
    }
  }

  useEffect(() => {
    const cachedShell = getCachedDashboardShell();
    const shellReady = window.sessionStorage.getItem("stackbuilder-dashboard-shell-ready") === "true";
    setHasLoadedDashboardShell(shellReady);
    if (cachedShell) {
      setMe(cachedShell.me);
      setTenants(cachedShell.tenants);
    }

    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);
        if (meResponse.activeTenant) {
          await loadForm(meResponse.activeTenant);
        }
      } catch {
        router.push("/login");
      }
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, formId, router]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadForm(response.activeTenant);
  }

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<FormSummary>(`/forms/${formId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, slug, status, fields: serializeRows(rows), mailSettings }),
      });
      setForm(updated);
      setRows(deserializeFields(updated.fields));
      setMailSettings(updated.mailSettings);
      toast.success("Form saved");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  const flatFields = useMemo(() => flattenRows(rows), [rows]);

  function addFieldAsNewRow(type: FormFieldType) {
    const field = createField(type, flatFields);
    field.width = 100;
    setRows((current) => [...current, { id: createId(), items: [{ kind: "field", field }] }]);
    setSelectedFieldId(field.id);
    setActiveTab("form");
  }

  function addRow(widths: number[]) {
    setRows((current) => [...current, { id: createId(), items: widths.map((width) => ({ kind: "empty" as const, width })) }]);
    setLayoutPickerOpen(false);
  }

  function removeRow(rowIndex: number) {
    setRows((current) => current.filter((_, index) => index !== rowIndex));
  }

  function moveRow(from: number | null, to: number) {
    if (from === null || from === to) return;
    setRows((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  }

  function fillSlot(rowIndex: number, itemIndex: number, type: FormFieldType) {
    setRows((current) =>
      current.map((row, ri) => {
        if (ri !== rowIndex) return row;
        return {
          ...row,
          items: row.items.map((item, ii) => {
            if (ii !== itemIndex) return item;
            const width = item.kind === "empty" ? item.width : (item.field.width ?? 100);
            const field = createField(type, flatFields);
            field.width = width;
            return { kind: "field" as const, field };
          }),
        };
      }),
    );
  }

  function updateField(fieldId: string, patch: Partial<FormField>) {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        items: row.items.map((item) => (item.kind === "field" && item.field.id === fieldId ? { kind: "field" as const, field: { ...item.field, ...patch } } : item)),
      })),
    );
  }

  function removeField(fieldId: string) {
    setRows((current) =>
      current
        .map((row) => {
          const index = row.items.findIndex((item) => item.kind === "field" && item.field.id === fieldId);
          if (index === -1) return row;
          if (row.items.length === 1) return null;
          const width = row.items[index]?.kind === "field" ? (row.items[index] as Extract<SlotItem, { kind: "field" }>).field.width ?? 100 : 100;
          return { ...row, items: row.items.map((item, i) => (i === index ? { kind: "empty" as const, width } : item)) };
        })
        .filter((row): row is LayoutRow => row !== null),
    );
    setSelectedFieldId((current) => (current === fieldId ? null : current));
  }

  function moveField(from: { rowIndex: number; itemIndex: number }, to: { rowIndex: number; itemIndex: number }) {
    if (from.rowIndex === to.rowIndex && from.itemIndex === to.itemIndex) return;
    setRows((current) => {
      const next = current.map((row) => ({ ...row, items: [...row.items] }));
      const source = next[from.rowIndex]?.items[from.itemIndex];
      const target = next[to.rowIndex]?.items[to.itemIndex];
      if (!source || source.kind !== "field" || !target) return current;

      if (target.kind === "field") {
        const sourceWidth = source.field.width;
        const targetWidth = target.field.width;
        next[to.rowIndex]!.items[to.itemIndex] = { kind: "field", field: { ...source.field, width: sourceWidth } };
        next[from.rowIndex]!.items[from.itemIndex] = { kind: "field", field: { ...target.field, width: targetWidth } };
      } else {
        next[to.rowIndex]!.items[to.itemIndex] = { kind: "field", field: { ...source.field, width: target.width } };
        next[from.rowIndex]!.items[from.itemIndex] = { kind: "empty", width: source.field.width ?? 100 };
      }
      return next;
    });
  }

  function insertToken(target: "subject" | "body", token: string) {
    if (target === "subject") {
      setMailSettings((current) => ({ ...current, subject: `${current.subject}${token}` }));
    } else {
      setMailSettings((current) => ({ ...current, bodyHtml: `${current.bodyHtml}${token}` }));
    }
  }

  const selectedField = useMemo(() => flatFields.find((field) => field.id === selectedFieldId) ?? null, [flatFields, selectedFieldId]);

  if (!hasLoadedDashboardShell && (!me || !website || !form)) {
    return <LoadingState label="Loading form builder" />;
  }

  if (!me || !website || !form) {
    return <LoadingState label="Loading form builder" contentOnly={hasLoadedDashboardShell} />;
  }

  return (
    <DashboardShell
      title={form.name}
      eyebrow="Form"
      description="Drag-and-drop field builder with validation, plus a customizable email notification template."
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Forms", href: `/websites/${website.id}/forms` },
        { label: form.name },
      ]}
      onTenantChange={switchTenant}
    >
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <Field label="Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Slug" hint="Used to identify this form's submission endpoint.">
              <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value as FormSummary["status"])}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            </Field>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push(`/websites/${website.id}/forms`)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button type="button" onClick={() => void save()} disabled={isSaving}>
              <Save className="size-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="inline-flex w-full gap-1 rounded-xl border bg-surface-secondary/50 p-1.5 sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("form")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-colors sm:flex-none",
            activeTab === "form"
              ? "bg-primary text-primary-foreground shadow-sm shadow-slate-950/10"
              : "text-muted-foreground hover:bg-surface hover:text-foreground",
          )}
        >
          <ClipboardList className="size-4" />
          Form
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("mail")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-colors sm:flex-none",
            activeTab === "mail"
              ? "bg-primary text-primary-foreground shadow-sm shadow-slate-950/10"
              : "text-muted-foreground hover:bg-surface hover:text-foreground",
          )}
        >
          <Mail className="size-4" />
          Mail
        </button>
      </div>

      {activeTab === "form" ? (
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_300px]">
          <Card className="content-start">
            <p className="text-[12.5px] font-semibold text-foreground">Field types</p>
            <div className="grid gap-4">
              {FIELD_GROUPS.map((group) => (
                <div key={group} className="grid gap-1.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{group}</p>
                  <div className="grid gap-1">
                    {FORM_FIELD_TYPES.filter((type) => FIELD_TYPE_META[type].group === group).map((type) => {
                      const meta = FIELD_TYPE_META[type];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={type}
                          type="button"
                          draggable
                          onDragStart={() => setDraggingPaletteType(type)}
                          onDragEnd={() => setDraggingPaletteType(null)}
                          onClick={() => addFieldAsNewRow(type)}
                          className="flex cursor-grab items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:border-input hover:bg-surface-secondary/60 active:cursor-grabbing"
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                          <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="content-start">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-foreground">Canvas</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setLayoutPickerOpen(true)}>
                <LayoutGrid className="size-4" />
                Add row
              </Button>
            </div>
            {rows.length ? (
              <div className="grid gap-3">
                {rows.map((row, rowIndex) => (
                  <div
                    key={row.id}
                    onDragOver={(event) => event.preventDefault()}
                    className={cn(
                      "grid gap-2 rounded-lg border border-dashed p-2 transition-colors",
                      rowOverIndex === rowIndex && draggingRowIndex !== null && draggingRowIndex !== rowIndex ? "border-info bg-info/5" : "border-border/70",
                      draggingRowIndex === rowIndex ? "opacity-50" : "",
                    )}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span
                        draggable
                        onDragStart={() => setDraggingRowIndex(rowIndex)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (rowOverIndex !== rowIndex) setRowOverIndex(rowIndex);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          moveRow(draggingRowIndex, rowIndex);
                          setDraggingRowIndex(null);
                          setRowOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDraggingRowIndex(null);
                          setRowOverIndex(null);
                        }}
                        className="flex cursor-grab items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground active:cursor-grabbing"
                      >
                        <GripVertical className="size-3.5" />
                        Row {rowIndex + 1}
                      </span>
                      <IconButton label={`Remove row ${rowIndex + 1}`} onClick={() => removeRow(rowIndex)}>
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </div>

                    <div
                      className="grid gap-2 overflow-x-auto"
                      style={{
                        gridTemplateColumns: row.items
                          .map((item) => `minmax(150px, ${item.kind === "field" ? (item.field.width ?? 100) : item.width}fr)`)
                          .join(" "),
                      }}
                    >
                      {row.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="min-w-0">
                          {item.kind === "field" ? (
                            <div
                              draggable
                              onDragStart={() => setMovingItem({ rowIndex, itemIndex })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (movingItem) moveField(movingItem, { rowIndex, itemIndex });
                                setMovingItem(null);
                              }}
                              onDragEnd={() => setMovingItem(null)}
                              onClick={() => setSelectedFieldId(item.field.id)}
                              className={cn(
                                "group flex h-full cursor-pointer items-center gap-2 rounded-md border bg-surface p-2.5 transition-shadow",
                                selectedFieldId === item.field.id ? "border-primary ring-2 ring-ring/20" : "border-border",
                              )}
                            >
                              <span className="cursor-grab px-0.5 text-muted-foreground/40 active:cursor-grabbing" aria-hidden="true">
                                <GripVertical className="size-4" />
                              </span>
                              <span className="text-muted-foreground">{fieldIcon(item.field.type)}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12.5px] font-semibold text-foreground">
                                  {item.field.label}
                                  {item.field.required ? <span className="ml-1 text-destructive">*</span> : null}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {FIELD_TYPE_META[item.field.type].label} · {item.field.name}
                                </p>
                              </div>
                              <IconButton
                                label={`Remove ${item.field.label}`}
                                className="text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeField(item.field.id);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </IconButton>
                            </div>
                          ) : (
                            <div
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (draggingPaletteType) {
                                  fillSlot(rowIndex, itemIndex, draggingPaletteType);
                                  setDraggingPaletteType(null);
                                } else if (movingItem) {
                                  moveField(movingItem, { rowIndex, itemIndex });
                                  setMovingItem(null);
                                }
                              }}
                              className="grid h-full min-h-16 place-items-center gap-1 rounded-lg border-2 border-dashed border-border bg-surface-secondary/40 p-2 text-center"
                            >
                              <select
                                value=""
                                onChange={(event) => {
                                  if (event.target.value) fillSlot(rowIndex, itemIndex, event.target.value as FormFieldType);
                                }}
                                className="w-full max-w-[170px] rounded-md border border-input bg-surface px-2 py-1 text-[11.5px] text-foreground"
                              >
                                <option value="">+ Choose field type</option>
                                {FORM_FIELD_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {FIELD_TYPE_META[type].label}
                                  </option>
                                ))}
                              </select>
                              <span className="text-[10px] text-muted-foreground">or drag a field type here · {item.width}%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingPaletteType) {
                    addFieldAsNewRow(draggingPaletteType);
                    setDraggingPaletteType(null);
                  }
                }}
                className="grid justify-items-center gap-3 rounded-lg border border-dashed bg-surface-secondary/60 px-5 py-10 text-center"
              >
                <p className="text-[12.5px] font-semibold text-foreground">No fields yet</p>
                <p className="max-w-xs text-[12px] leading-5 text-muted-foreground">
                  Choose a column layout, then drag or pick a field type for each column — or click a field type on the left to add it as its own row.
                </p>
                <Button type="button" size="sm" onClick={() => setLayoutPickerOpen(true)}>
                  <LayoutGrid className="size-4" />
                  Choose column layout
                </Button>
              </div>
            )}
          </Card>

          <Card className="content-start">
            <p className="text-[12.5px] font-semibold text-foreground">Field settings</p>
            {selectedField ? (
              <FieldSettingsPanel
                field={selectedField}
                fields={flatFields}
                onChange={(patch) => updateField(selectedField.id, patch)}
              />
            ) : (
              <p className="text-[12px] leading-5 text-muted-foreground">Select a field on the canvas to edit its settings.</p>
            )}
          </Card>
        </div>
      ) : (
        <MailTab
          mailSettings={mailSettings}
          onChange={setMailSettings}
          fields={flatFields}
          onInsertToken={insertToken}
        />
      )}

      <Modal
        open={layoutPickerOpen}
        title="Choose a column layout"
        description="Pick how many columns this row should have, then drag or pick a field type for each column."
        onClose={() => setLayoutPickerOpen(false)}
      >
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {LAYOUT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => addRow(preset.widths)}
              className="grid gap-2 rounded-lg border p-3 text-center transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-10 items-stretch gap-1">
                {preset.widths.map((width, index) => (
                  <div key={index} style={{ flexBasis: `${width}%` }} className="flex-1 rounded bg-muted" />
                ))}
              </div>
              <span className="text-[11.5px] font-medium text-foreground">{preset.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </DashboardShell>
  );
}

function FieldSettingsPanel({
  field,
  fields,
  onChange,
}: {
  field: FormField;
  fields: FormField[];
  onChange: (patch: Partial<FormField>) => void;
}) {
  const isButtonLike = BUTTON_TYPES.has(field.type);

  return (
    <div className="grid gap-3">
      <Badge>{FIELD_TYPE_META[field.type].label}</Badge>

      <Field label={isButtonLike ? "Button text" : "Label"}>
        <Input value={field.label} onChange={(event) => onChange({ label: event.target.value })} />
      </Field>

      <Field label="Field name" hint="Used as the submission key and in {{name}} mail placeholders.">
        <Input
          value={field.name}
          onChange={(event) => onChange({ name: uniqueFieldName(slugifyName(event.target.value), fields, field.id) })}
        />
      </Field>

      {field.type !== "hidden" ? (
        <Field label="Column width">
          <Select value={String(field.width ?? 100)} onChange={(event) => onChange({ width: Number(event.target.value) })}>
            {WIDTH_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {supportsPlaceholder(field.type) ? (
        <Field label="Placeholder">
          <Input value={field.placeholder ?? ""} onChange={(event) => onChange({ placeholder: event.target.value })} />
        </Field>
      ) : null}

      {supportsHelpText(field.type) ? (
        <Field label="Help text">
          <Input value={field.helpText ?? ""} onChange={(event) => onChange({ helpText: event.target.value })} />
        </Field>
      ) : null}

      {supportsDefaultValue(field.type) ? (
        <Field label="Default value">
          <Input value={field.defaultValue ?? ""} onChange={(event) => onChange({ defaultValue: event.target.value })} />
        </Field>
      ) : null}

      {supportsRequired(field.type) ? (
        <Checkbox label="Required" checked={Boolean(field.required)} onChange={(event) => onChange({ required: event.target.checked })} />
      ) : null}

      {supportsOptions(field.type) ? (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(options) => onChange({ options })}
        />
      ) : null}

      {supportsQuizAnswer(field.type) ? (
        <Field label="Correct answer" hint="Matched (case-insensitively) against the submitted value.">
          {field.options?.length ? (
            <Select value={field.quizAnswer ?? ""} onChange={(event) => onChange({ quizAnswer: event.target.value })}>
              <option value="">Select the correct option</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input value={field.quizAnswer ?? ""} onChange={(event) => onChange({ quizAnswer: event.target.value })} />
          )}
        </Field>
      ) : null}

      {supportsMinMaxStep(field.type) ? (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Min">
            <Input
              type="number"
              value={field.min ?? ""}
              onChange={(event) => onChange({ min: event.target.value === "" ? undefined : Number(event.target.value) })}
            />
          </Field>
          <Field label="Max">
            <Input
              type="number"
              value={field.max ?? ""}
              onChange={(event) => onChange({ max: event.target.value === "" ? undefined : Number(event.target.value) })}
            />
          </Field>
          <Field label="Step">
            <Input
              type="number"
              value={field.step ?? ""}
              onChange={(event) => onChange({ step: event.target.value === "" ? undefined : Number(event.target.value) })}
            />
          </Field>
        </div>
      ) : null}

      {supportsMinMaxLength(field.type) ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Min length">
            <Input
              type="number"
              value={field.minLength ?? ""}
              onChange={(event) => onChange({ minLength: event.target.value === "" ? undefined : Number(event.target.value) })}
            />
          </Field>
          <Field label="Max length">
            <Input
              type="number"
              value={field.maxLength ?? ""}
              onChange={(event) => onChange({ maxLength: event.target.value === "" ? undefined : Number(event.target.value) })}
            />
          </Field>
        </div>
      ) : null}

      {supportsPattern(field.type) ? (
        <Field label="Pattern" hint="Optional regular expression the value must match.">
          <Input value={field.pattern ?? ""} onChange={(event) => onChange({ pattern: event.target.value })} />
        </Field>
      ) : null}

      {supportsAcceptedFileTypes(field.type) ? (
        <Field label="Accepted file types" hint="e.g. .pdf,.png,.jpg">
          <Input value={field.acceptedFileTypes ?? ""} onChange={(event) => onChange({ acceptedFileTypes: event.target.value })} />
        </Field>
      ) : null}

      {supportsRows(field.type) ? (
        <Field label="Rows">
          <Input
            type="number"
            value={field.rows ?? ""}
            onChange={(event) => onChange({ rows: event.target.value === "" ? undefined : Number(event.target.value) })}
          />
        </Field>
      ) : null}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: FormFieldOption[]; onChange: (options: FormFieldOption[]) => void }) {
  function updateOption(index: number, patch: Partial<FormFieldOption>) {
    onChange(options.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option)));
  }

  function addOption() {
    const nextIndex = options.length + 1;
    onChange([...options, { label: `Option ${nextIndex}`, value: `option-${nextIndex}` }]);
  }

  function removeOption(index: number) {
    onChange(options.filter((_, optionIndex) => optionIndex !== index));
  }

  return (
    <Field label="Options">
      <div className="grid gap-1.5">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              className="min-w-0 flex-1"
              value={option.label}
              placeholder="Label"
              onChange={(event) => updateOption(index, { label: event.target.value })}
            />
            <Input
              className="min-w-0 flex-1"
              value={option.value}
              placeholder="Value"
              onChange={(event) => updateOption(index, { value: event.target.value })}
            />
            <IconButton label="Remove option" onClick={() => removeOption(index)}>
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-info transition-colors hover:bg-info/10"
        >
          <Plus className="size-3.5" />
          Add option
        </button>
      </div>
    </Field>
  );
}

function MailTab({
  mailSettings,
  onChange,
  fields,
  onInsertToken,
}: {
  mailSettings: FormMailSettings;
  onChange: (mailSettings: FormMailSettings) => void;
  fields: FormField[];
  onInsertToken: (target: "subject" | "body", token: string) => void;
}) {
  const namedFields = fields.filter((field) => !BUTTON_TYPES.has(field.type));

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="content-start">
        <p className="text-[12.5px] font-semibold text-foreground">Email notification</p>
        <Checkbox
          label="Send an email notification on each submission"
          checked={mailSettings.enabled}
          onChange={(event) => onChange({ ...mailSettings, enabled: event.target.checked })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="To">
            <Input
              type="email"
              value={mailSettings.to}
              onChange={(event) => onChange({ ...mailSettings, to: event.target.value })}
              placeholder="notifications@example.com"
            />
          </Field>
          <Field label="From">
            <Input
              type="email"
              value={mailSettings.from}
              onChange={(event) => onChange({ ...mailSettings, from: event.target.value })}
              placeholder="no-reply@example.com"
            />
          </Field>
        </div>
        <Field label="Additional headers" hint="One 'Header-Name: value' per line, e.g. Reply-To: {{email}}">
          <Textarea
            value={mailSettings.additionalHeaders}
            onChange={(event) => onChange({ ...mailSettings, additionalHeaders: event.target.value })}
            rows={3}
          />
        </Field>
        <Field label="Subject">
          <Input
            value={mailSettings.subject}
            onChange={(event) => onChange({ ...mailSettings, subject: event.target.value })}
          />
        </Field>
        <Field label="Message body" hint="HTML template — {{field_name}} is replaced with the submitted value.">
          <Textarea
            value={mailSettings.bodyHtml}
            onChange={(event) => onChange({ ...mailSettings, bodyHtml: event.target.value })}
            rows={12}
            className="font-mono text-[12px]"
          />
        </Field>

        <div className="grid gap-1.5">
          <p className="text-[11.5px] font-semibold text-foreground">Preview</p>
          <iframe
            title="Message body preview"
            srcDoc={mailSettings.bodyHtml}
            sandbox=""
            className="h-48 w-full rounded-md border bg-white"
          />
        </div>
      </Card>

      <Card className="content-start">
        <p className="text-[12.5px] font-semibold text-foreground">Available placeholders</p>
        <p className="text-[11.5px] leading-5 text-muted-foreground">
          Click to insert into the subject or message body.
        </p>
        {namedFields.length ? (
          <div className="grid gap-1.5">
            {namedFields.map((field) => (
              <div key={field.id} className="flex items-center justify-between gap-2 rounded-md border bg-surface-secondary/40 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-foreground">{field.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{`{{${field.name}}}`}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="secondary" onClick={() => onInsertToken("subject", `{{${field.name}}}`)}>
                    Subject
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => onInsertToken("body", `{{${field.name}}}`)}>
                    Body
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] leading-5 text-muted-foreground">Add fields on the Form tab to use them as placeholders here.</p>
        )}
      </Card>
    </div>
  );
}
