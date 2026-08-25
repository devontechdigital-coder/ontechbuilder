import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PageStatus, Prisma } from "../../core/database/database.js";
import { optionalString, requiredSlug, requiredString } from "../../core/common/input.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { MailerService } from "../../core/mail/mailer.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";

interface ActorInput {
  actorUserId: string;
  tenantId: string;
}

interface ListFormsInput extends ActorInput {
  websiteId: string;
  status?: unknown;
  query?: unknown;
  includeCounts?: unknown;
}

interface CreateFormInput extends ActorInput {
  websiteId: string;
  name: unknown;
  slug?: unknown;
}

interface UpdateFormInput extends ActorInput {
  formId: string;
  name?: unknown;
  slug?: unknown;
  status?: unknown;
  fields?: unknown;
  mailSettings?: unknown;
  customCss?: unknown;
}

interface BulkFormActionInput extends ActorInput {
  formIds: unknown;
  action: unknown;
}

/**
 * A field's stored shape. Loose enough to cover every field type's own extras (options for
 * select/radio/checkbox, min/max for number/range/date-likes, a quiz's expected answer, ...)
 * without a dozen near-identical interfaces — parseFormField below is what actually enforces
 * per-field-type shape at the boundary.
 */
export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  acceptedFileTypes?: string;
  quizAnswer?: string;
  rows?: number;
  /** Column-grid placement — which row/column this field sits in, and what % width its column spans. Purely a layout hint for the builder canvas; unrelated to submission validation. */
  row?: number;
  column?: number;
  width?: number;
}

export const FORM_FIELD_TYPES = [
  "text",
  "email",
  "url",
  "tel",
  "number",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "password",
  "search",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "acceptance",
  "quiz",
  "file",
  "hidden",
  "range",
  "submit",
  "reset",
  "button",
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Field types whose value is meaningful in a submission — buttons carry nothing to validate or store. */
const NON_INPUT_FIELD_TYPES: ReadonlySet<FormFieldType> = new Set(["submit", "reset", "button"]);

export interface FormMailSettings {
  enabled: boolean;
  to: string;
  from: string;
  additionalHeaders: string;
  subject: string;
  bodyHtml: string;
}

const defaultMailSettings: FormMailSettings = {
  enabled: false,
  to: "",
  from: "",
  additionalHeaders: "",
  subject: "New form submission",
  bodyHtml: "<p>You received a new submission.</p>",
};

const maxFields = 100;
const maxMailFieldLength = 20_000;
const maxCustomCssLength = 20_000;

export const formSelect = {
  id: true,
  tenantId: true,
  websiteId: true,
  name: true,
  slug: true,
  status: true,
  fields: true,
  mailSettings: true,
  customCss: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FormSelect;

@Injectable()
export class FormsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
    @Inject(MailerService) private readonly mailer: MailerService,
  ) {}

  async listForms(input: ListFormsInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const status = parseOptionalStatusFilter(input.status);
    const query = optionalString(input.query, "q")?.trim();
    const baseWhere: Prisma.FormWhereInput = {
      tenantId: input.tenantId,
      websiteId: input.websiteId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const data = await this.prisma.form.findMany({
      where: {
        ...baseWhere,
        ...(status ? { status } : { status: { not: PageStatus.ARCHIVED } }),
      },
      orderBy: { name: "asc" },
      select: formSelect,
    });

    if (!parseOptionalQueryBoolean(input.includeCounts)) {
      return data;
    }

    const groupedCounts = await this.prisma.form.groupBy({
      by: ["status"],
      where: { tenantId: input.tenantId, websiteId: input.websiteId },
      _count: { _all: true },
    });
    const counts = {
      all: groupedCounts.reduce((total, item) => total + (item.status === PageStatus.ARCHIVED ? 0 : item._count._all), 0),
      DRAFT: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };
    for (const item of groupedCounts) counts[item.status] = item._count._all;

    return { data, counts };
  }

  async getForm(actorUserId: string, tenantId: string, formId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
      select: formSelect,
    });

    if (!form) {
      throw new NotFoundException("Form was not found in this tenant");
    }

    return form;
  }

  async createForm(input: CreateFormInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    const name = requiredString(input.name, "name");
    const slug = input.slug === undefined || input.slug === null || input.slug === "" ? slugify(name) : requiredSlug(input.slug);

    try {
      return await this.prisma.form.create({
        data: {
          tenantId: input.tenantId,
          websiteId: input.websiteId,
          name,
          slug,
          fields: [] as unknown as Prisma.InputJsonValue,
          mailSettings: defaultMailSettings as unknown as Prisma.InputJsonValue,
        },
        select: formSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Form slug already exists for this website");
    }
  }

  async updateForm(input: UpdateFormInput) {
    const form = await this.assertFormAccessForActor(input.actorUserId, input.tenantId, input.formId);
    const data: Prisma.FormUpdateInput = {};

    if (input.name !== undefined) {
      data.name = requiredString(input.name, "name");
    }
    if (input.slug !== undefined) {
      data.slug = requiredSlug(input.slug);
    }
    if (input.status !== undefined) {
      data.status = parseRequiredStatus(input.status);
    }
    if (input.fields !== undefined) {
      data.fields = parseFormFields(input.fields);
    }
    if (input.mailSettings !== undefined) {
      data.mailSettings = parseMailSettings(input.mailSettings);
    }
    if (input.customCss !== undefined) {
      data.customCss = parseCustomCss(input.customCss);
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException("At least one form field is required");
    }

    try {
      return await this.prisma.form.update({
        where: { id: form.id, tenantId: input.tenantId },
        data,
        select: formSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Form slug already exists for this website");
    }
  }

  async cloneForm(actorUserId: string, tenantId: string, formId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const source = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
      select: { websiteId: true, name: true, slug: true, fields: true, mailSettings: true },
    });

    if (!source) {
      throw new NotFoundException("Form was not found in this tenant");
    }

    const slug = await this.getUniqueFormSlug(tenantId, source.websiteId, `${source.slug}-copy`);

    return this.prisma.form.create({
      data: {
        tenantId,
        websiteId: source.websiteId,
        name: `${source.name} copy`,
        slug,
        fields: source.fields as Prisma.InputJsonValue,
        mailSettings: source.mailSettings as Prisma.InputJsonValue,
        status: PageStatus.DRAFT,
      },
      select: formSelect,
    });
  }

  async archiveForm(actorUserId: string, tenantId: string, formId: string) {
    const form = await this.assertFormAccessForActor(actorUserId, tenantId, formId);

    return this.prisma.form.update({
      where: { id: form.id, tenantId },
      data: { status: PageStatus.ARCHIVED },
      select: { id: true, status: true },
    });
  }

  async bulkFormAction(input: BulkFormActionInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const formIds = parseFormIds(input.formIds);
    const action = parseBulkAction(input.action);

    if (action === "DELETE") {
      return this.deleteForms(input.actorUserId, input.tenantId, formIds);
    }

    const status = action === "PUBLISH" ? PageStatus.PUBLISHED : action === "DRAFT" ? PageStatus.DRAFT : PageStatus.ARCHIVED;
    const forms = await this.prisma.form.findMany({
      where: { id: { in: formIds }, tenantId: input.tenantId },
      select: { id: true },
    });

    if (forms.length !== formIds.length) {
      throw new NotFoundException("One or more forms were not found in this tenant");
    }

    await this.prisma.form.updateMany({
      where: { id: { in: formIds }, tenantId: input.tenantId },
      data: { status },
    });

    return { updated: formIds.length, status };
  }

  /**
   * Public entry point — no auth. Returns only what a visitor's browser needs to render the
   * form itself (name + field definitions) — never mailSettings, which can carry an internal
   * notification address.
   */
  async getPublicForm(formId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, status: { not: PageStatus.ARCHIVED } },
      select: { id: true, name: true, fields: true, customCss: true },
    });

    if (!form) {
      throw new NotFoundException("Form was not found or is no longer accepting submissions");
    }

    return form;
  }

  /**
   * Public entry point — no auth, called by an anonymous visitor's browser POST from the live
   * rendered site. Validates the submission against the form's own field definitions (required-
   * ness, email/url/number shape, select/radio/checkbox membership, quiz answer), stores it
   * regardless of whether notification email delivery is configured, and — if mail is enabled —
   * sends the notification, recording whether that succeeded rather than failing the submission
   * over an email problem a visitor has no way to fix.
   */
  async submitForm(formId: string, data: unknown) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, status: { not: PageStatus.ARCHIVED } },
      select: { id: true, tenantId: true, fields: true, mailSettings: true },
    });

    if (!form) {
      throw new NotFoundException("Form was not found or is no longer accepting submissions");
    }

    const fields = Array.isArray(form.fields) ? (form.fields as unknown as FormField[]) : [];
    const submission = validateSubmission(fields, data);

    const created = await this.prisma.formSubmission.create({
      data: {
        tenantId: form.tenantId,
        formId: form.id,
        data: submission as Prisma.InputJsonValue,
      },
      select: { id: true, createdAt: true },
    });

    const mailSettings = normalizeMailSettings(form.mailSettings);
    if (!mailSettings.enabled || !mailSettings.to) {
      return { id: created.id, submittedAt: created.createdAt };
    }

    const bodyHtml = renderMailTemplate(mailSettings.bodyHtml, submission, fields);
    const headers = parseAdditionalHeaders(mailSettings.additionalHeaders);
    const result = await this.mailer.send({
      to: mailSettings.to,
      subject: renderMailTemplate(mailSettings.subject, submission, fields) || defaultMailSettings.subject,
      html: bodyHtml,
      ...(mailSettings.from ? { from: mailSettings.from } : {}),
      ...(headers ? { headers } : {}),
    });

    await this.prisma.formSubmission.update({
      where: { id: created.id },
      data: { mailSent: result.sent, mailError: result.error ?? null },
    });

    return { id: created.id, submittedAt: created.createdAt, mailSent: result.sent };
  }

  private async deleteForms(actorUserId: string, tenantId: string, formIds: string[]) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const forms = await this.prisma.form.findMany({
      where: { id: { in: formIds }, tenantId },
      select: { id: true },
    });

    if (forms.length !== formIds.length) {
      throw new NotFoundException("One or more forms were not found in this tenant");
    }

    await this.prisma.form.deleteMany({ where: { id: { in: formIds }, tenantId } });
    return { deleted: formIds.length };
  }

  private async assertFormAccessForActor(actorUserId: string, tenantId: string, formId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    return this.assertFormAccess(tenantId, formId);
  }

  private async assertFormAccess(tenantId: string, formId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
      select: { id: true, websiteId: true },
    });

    if (!form) {
      throw new NotFoundException("Form was not found in this tenant");
    }

    return form;
  }

  private async getUniqueFormSlug(tenantId: string, websiteId: string, baseSlug: string) {
    const existingForms = await this.prisma.form.findMany({
      where: { tenantId, websiteId, slug: { startsWith: baseSlug } },
      select: { slug: true },
    });
    const existingSlugs = new Set(existingForms.map((form) => form.slug));

    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }

    for (let suffix = 2; suffix <= 500; suffix += 1) {
      const slug = `${baseSlug}-${suffix}`;
      if (!existingSlugs.has(slug)) return slug;
    }

    throw new ConflictException("Could not generate a unique form slug");
  }
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return requiredSlug(slug, "slug");
}

function mapUniqueError(error: unknown, message: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException(message);
  }
  if (error instanceof ForbiddenException || error instanceof BadRequestException) {
    return error;
  }
  return error instanceof Error ? error : new Error("Unexpected database error");
}

function parseOptionalStatusFilter(value: unknown): PageStatus | undefined {
  if (value === undefined || value === null || value === "" || value === "all") return undefined;
  const status = requiredString(value, "status").toUpperCase();
  if (!Object.values(PageStatus).includes(status as PageStatus)) {
    throw new BadRequestException("status must be draft, published, archived, or all");
  }
  return status as PageStatus;
}

function parseRequiredStatus(value: unknown): PageStatus {
  const status = requiredString(value, "status").toUpperCase();
  if (!Object.values(PageStatus).includes(status as PageStatus) || status === PageStatus.ARCHIVED) {
    throw new BadRequestException("status must be draft or published");
  }
  return status as PageStatus;
}

function parseOptionalQueryBoolean(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return value === true || value === "true";
}

function parseFormIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException("formIds must be an array");
  }
  const ids = value.map((item) => requiredString(item, "formId"));
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) {
    throw new BadRequestException("At least one form must be selected");
  }
  return uniqueIds;
}

function parseBulkAction(value: unknown): "PUBLISH" | "DRAFT" | "ARCHIVE" | "DELETE" {
  const action = requiredString(value, "action").toUpperCase();
  if (action !== "PUBLISH" && action !== "DRAFT" && action !== "ARCHIVE" && action !== "DELETE") {
    throw new BadRequestException("action must be publish, draft, archive, or delete");
  }
  return action;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Unlike the shared optionalString (which throws on an empty string — right for things like a
 * slug, where "" and "not set" are different mistakes), a field's placeholder/defaultValue/
 * helpText/pattern/quizAnswer are genuinely optional: an empty string here just means "not set",
 * not a client error, so this returns undefined instead of throwing.
 */
function optionalFieldString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Whitelists a single field definition. Every field carries the common shape (id/type/label/name
 * + generic optional extras); nothing here is type-exclusive on the write side — the builder UI
 * is what only shows the relevant controls per type — so a theme swap that repurposes a field
 * (e.g. widening a select's options) never gets silently stripped for using "the wrong" extra.
 */
function parseFormField(value: unknown, index: number): FormField {
  if (!isRecord(value)) {
    throw new BadRequestException(`fields[${index}] must be an object`);
  }

  const type = requiredString(value.type, `fields[${index}].type`);
  if (!(FORM_FIELD_TYPES as readonly string[]).includes(type)) {
    throw new BadRequestException(`fields[${index}].type is not a recognized field type`);
  }

  const field: FormField = {
    id: requiredString(value.id, `fields[${index}].id`),
    type: type as FormFieldType,
    label: requiredString(value.label, `fields[${index}].label`),
    name: requiredString(value.name, `fields[${index}].name`).replace(/[^A-Za-z0-9_-]/g, "_"),
  };

  const placeholder = optionalFieldString(value.placeholder);
  if (placeholder) field.placeholder = placeholder;

  if (typeof value.required === "boolean") field.required = value.required;

  const defaultValue = optionalFieldString(value.defaultValue);
  if (defaultValue !== undefined) field.defaultValue = defaultValue;

  const helpText = optionalFieldString(value.helpText);
  if (helpText) field.helpText = helpText;

  if (Array.isArray(value.options)) {
    field.options = value.options.slice(0, 100).map((option, optionIndex) => {
      if (!isRecord(option)) throw new BadRequestException(`fields[${index}].options[${optionIndex}] must be an object`);
      return {
        label: requiredString(option.label, `fields[${index}].options[${optionIndex}].label`),
        value: requiredString(option.value, `fields[${index}].options[${optionIndex}].value`),
      };
    });
  }

  for (const key of ["min", "max", "step", "minLength", "maxLength"] as const) {
    const raw = value[key];
    if (typeof raw === "number" && Number.isFinite(raw)) field[key] = raw;
  }

  const pattern = optionalFieldString(value.pattern);
  if (pattern) field.pattern = pattern;

  const acceptedFileTypes = optionalFieldString(value.acceptedFileTypes);
  if (acceptedFileTypes) field.acceptedFileTypes = acceptedFileTypes;

  const quizAnswer = optionalFieldString(value.quizAnswer);
  if (quizAnswer !== undefined) field.quizAnswer = quizAnswer;

  if (typeof value.rows === "number" && Number.isFinite(value.rows)) field.rows = value.rows;

  for (const key of ["row", "column", "width"] as const) {
    const raw = value[key];
    if (typeof raw === "number" && Number.isFinite(raw)) field[key] = raw;
  }

  return field;
}

export function parseFormFields(value: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(value)) {
    throw new BadRequestException("fields must be an array");
  }
  if (value.length > maxFields) {
    throw new BadRequestException(`fields cannot exceed ${maxFields} entries`);
  }

  const fields = value.map((field, index) => parseFormField(field, index));
  const ids = new Set<string>();
  for (const field of fields) {
    if (ids.has(field.id)) {
      throw new BadRequestException(`Duplicate field id: ${field.id}`);
    }
    ids.add(field.id);
  }

  return fields as unknown as Prisma.InputJsonValue;
}

/** No sanitization beyond a length cap — this is plain CSS text, injected into a <style> tag (never HTML/JS), and only the form's own owner (an authenticated EDITOR) can ever write it. */
function parseCustomCss(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new BadRequestException("customCss must be a string");
  if (value.length > maxCustomCssLength) throw new BadRequestException("customCss is too long");
  return value;
}

function mailString(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new BadRequestException(`${field} must be a string`);
  if (value.length > maxLength) throw new BadRequestException(`${field} is too long`);
  return value;
}

export function parseMailSettings(value: unknown): Prisma.InputJsonValue {
  const source = isRecord(value) ? value : {};
  const enabled = typeof source.enabled === "boolean" ? source.enabled : false;
  const to = mailString(source.to, "to", 320);
  const from = mailString(source.from, "from", 320);

  if (enabled && !to) {
    throw new BadRequestException('"to" is required when email notifications are enabled');
  }

  const mail: FormMailSettings = {
    enabled,
    to,
    from,
    additionalHeaders: mailString(source.additionalHeaders, "additionalHeaders", maxMailFieldLength),
    subject: mailString(source.subject, "subject", 500) || defaultMailSettings.subject,
    bodyHtml: mailString(source.bodyHtml, "bodyHtml", maxMailFieldLength) || defaultMailSettings.bodyHtml,
  };

  return mail as unknown as Prisma.InputJsonValue;
}

function normalizeMailSettings(value: unknown): FormMailSettings {
  const source = isRecord(value) ? value : {};
  return {
    ...defaultMailSettings,
    ...Object.fromEntries(
      Object.keys(defaultMailSettings).map((key) => [key, source[key] ?? defaultMailSettings[key as keyof FormMailSettings]]),
    ),
  };
}

/** "Header-Name: value" per line — the same convention a raw email header block already reads as. */
function parseAdditionalHeaders(raw: string): Record<string, string> | undefined {
  if (!raw.trim()) return undefined;
  const headers: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;
    const name = line.slice(0, separatorIndex).trim();
    const headerValue = line.slice(separatorIndex + 1).trim();
    if (name && headerValue) headers[name] = headerValue;
  }
  return Object.keys(headers).length ? headers : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replaces {{field_name}} placeholders in a mail subject/body template with the submission's own values. */
function renderMailTemplate(template: string, submission: Record<string, unknown>, fields: FormField[]): string {
  const labelByName = new Map(fields.map((field) => [field.name, field.label]));
  return template.replace(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g, (_match, name: string) => {
    const raw = submission[name];
    if (raw === undefined || raw === null) return "";
    const text = Array.isArray(raw) ? raw.join(", ") : String(raw);
    void labelByName; // reserved for a future "{{label:field}}" form; keeps the map from looking unused today
    return escapeHtml(text);
  });
}

/**
 * Re-validates every submitted value against its field's own rules — required-ness, email/url
 * shape, numeric range, membership in a select/radio/checkbox's own option list, and a quiz's
 * expected answer — server-side, since a public POST can't be trusted to have gone through the
 * live form's own client-side constraints at all.
 */
function validateSubmission(fields: FormField[], data: unknown): Record<string, unknown> {
  const source = isRecord(data) ? data : {};
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (NON_INPUT_FIELD_TYPES.has(field.type)) continue;
    const raw = source[field.name];
    const isEmpty = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);

    if (field.required && isEmpty && field.type !== "hidden") {
      throw new BadRequestException(`${field.label} is required`);
    }
    if (isEmpty) {
      result[field.name] = field.type === "checkbox" ? [] : "";
      continue;
    }

    result[field.name] = validateFieldValue(field, raw);
  }

  return result;
}

function validateFieldValue(field: FormField, raw: unknown): unknown {
  switch (field.type) {
    case "email": {
      const value = String(raw);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException(`${field.label} must be a valid email address`);
      return value;
    }
    case "url": {
      const value = String(raw);
      try {
        new URL(value);
      } catch {
        throw new BadRequestException(`${field.label} must be a valid URL`);
      }
      return value;
    }
    case "number":
    case "range": {
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new BadRequestException(`${field.label} must be a number`);
      if (field.min !== undefined && value < field.min) throw new BadRequestException(`${field.label} must be at least ${field.min}`);
      if (field.max !== undefined && value > field.max) throw new BadRequestException(`${field.label} must be at most ${field.max}`);
      return value;
    }
    case "select":
    case "radio": {
      const value = String(raw);
      if (field.options?.length && !field.options.some((option) => option.value === value)) {
        throw new BadRequestException(`${field.label} must be one of the offered options`);
      }
      return value;
    }
    case "checkbox": {
      const values = (Array.isArray(raw) ? raw : [raw]).map((item) => String(item));
      if (field.options?.length) {
        for (const value of values) {
          if (!field.options.some((option) => option.value === value)) {
            throw new BadRequestException(`${field.label} contains an option that isn't offered`);
          }
        }
      }
      return values;
    }
    case "acceptance": {
      const accepted = raw === true || raw === "true" || raw === "on";
      if (field.required && !accepted) throw new BadRequestException(`${field.label} must be accepted`);
      return accepted;
    }
    case "quiz": {
      const value = String(raw);
      if (field.quizAnswer !== undefined && value.trim().toLowerCase() !== field.quizAnswer.trim().toLowerCase()) {
        throw new BadRequestException(`${field.label} answer is incorrect`);
      }
      return value;
    }
    default: {
      const value = String(raw);
      if (field.minLength !== undefined && value.length < field.minLength) {
        throw new BadRequestException(`${field.label} is too short`);
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        throw new BadRequestException(`${field.label} is too long`);
      }
      if (field.pattern) {
        try {
          if (!new RegExp(field.pattern).test(value)) throw new BadRequestException(`${field.label} is not in the expected format`);
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
        }
      }
      return value;
    }
  }
}
