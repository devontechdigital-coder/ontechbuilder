export interface PageResult<T> {
  data: T[];
  nextCursor: string | null;
}

export interface WebsiteSummary {
  id: string;
  tenantId: string;
  homePageId: string | null;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface DomainSummary {
  id: string;
  tenantId: string;
  websiteId: string;
  hostname: string;
  normalizedHostname: string;
  status: "PENDING" | "VERIFIED" | "DISABLED";
  isPrimary: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "FAILED";
  verificationToken: string;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageSummary {
  id: string;
  websiteId: string;
  parentId: string | null;
  blogCategoryId: string | null;
  title: string;
  slug: string;
  templateId: string | null;
  kind: "PAGE" | "BLOG";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  draftVersionId: string | null;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlogCategorySummary {
  id: string;
  tenantId: string;
  websiteId: string;
  name: string;
  slug: string;
  image: string | null;
  imageAlt: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface BlogCategoryListSummary {
  data: BlogCategorySummary[];
  counts: {
    all: number;
    DRAFT: number;
    PUBLISHED: number;
    ARCHIVED: number;
  };
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

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  helpText?: string;
  options?: FormFieldOption[];
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  minLength?: number | undefined;
  maxLength?: number | undefined;
  pattern?: string;
  acceptedFileTypes?: string;
  quizAnswer?: string;
  rows?: number | undefined;
  row?: number | undefined;
  column?: number | undefined;
  width?: number | undefined;
}

export interface FormMailSettings {
  enabled: boolean;
  to: string;
  from: string;
  additionalHeaders: string;
  subject: string;
  bodyHtml: string;
}

export interface FormSummary {
  id: string;
  tenantId: string;
  websiteId: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  fields: FormField[];
  mailSettings: FormMailSettings;
  createdAt: string;
  updatedAt: string;
}

export interface FormListSummary {
  data: FormSummary[];
  counts: {
    all: number;
    DRAFT: number;
    PUBLISHED: number;
    ARCHIVED: number;
  };
}

export const LEAD_STATUSES = ["NEW", "OPEN", "QUALIFIED", "MEETING_BOOKED", "FOLLOW_UP", "CLOSED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadSummary {
  id: string;
  tenantId: string;
  formId: string;
  data: Record<string, unknown>;
  status: LeadStatus;
  mailSent: boolean;
  mailError: string | null;
  createdAt: string;
  updatedAt: string;
  form: { id: string; name: string; slug: string };
}

export interface LeadStats {
  total: number;
  totalChangePct: number;
  newToday: number;
  newTodayChangePct: number;
  inProgress: number;
  inProgressChangePct: number;
  meetingsBooked: number;
  meetingsBookedChangePct: number;
}

export interface LeadListSummary {
  data: LeadSummary[];
  total: number;
  page: number;
  pageSize: number;
  stats: LeadStats;
  forms: Array<{ id: string; name: string }>;
}

export interface PageListSummary {
  data: PageSummary[];
  counts: {
    all: number;
    DRAFT: number;
    PUBLISHED: number;
    ARCHIVED: number;
  };
}

export interface ThemeInstallationSummary {
  id: string;
  tenantId: string;
  websiteId: string;
  themePackageId: string;
  activeVersionId: string | null;
  currentDraftId: string | null;
  name: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  thumbnailKey: string | null;
  createdAt: string;
  updatedAt: string;
  themePackage: {
    name: string;
    source: string;
    category: string | null;
    engineVersion: string;
  };
  activeVersion: {
    id: string;
    versionNumber: number;
    createdAt: string;
  } | null;
  _count: {
    drafts: number;
    versions: number;
    revisions: number;
  };
}

export interface ThemeDefinitionSummary {
  id: string;
  name: string;
  version: string;
  engineVersion: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  preview?: {
    type: "placeholder";
    accent: string;
  };
  manifest: Record<string, unknown>;
  settings: Record<string, unknown>;
  settingsSchema: ThemeSettingDefinition[];
  sections: ThemeSectionDefinition[];
  templates: Array<{ id: string; name: string; file: string }>;
}

export interface ThemeSettingDefinition {
  id: string;
  type: "color" | "range" | "select" | "boolean" | "text" | "textarea" | "url";
  label: string;
  group: string;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface ThemeSectionDefinition {
  id: string;
  name: string;
  file: string;
  settings: ThemeSettingDefinition[];
}

export interface ThemeDraftSummary {
  id: string;
  tenantId: string;
  installationId: string;
  baseVersionId: string | null;
  revision: number;
  manifest: Record<string, unknown>;
  settings: Record<string, unknown>;
  fileManifest: { files?: Array<{ path: string; size: number; kind: string }> };
  files: Record<string, string>;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeVersionSummary {
  id: string;
  tenantId: string;
  installationId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  manifest: Record<string, unknown>;
  settings: Record<string, unknown>;
  fileManifest: Record<string, unknown>;
  storageKey: string | null;
  checksum: string | null;
  message: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ThemeRevisionSummary {
  id: string;
  tenantId: string;
  installationId: string;
  draftId: string | null;
  versionId: string | null;
  actorUserId: string;
  changeType: string;
  message: string | null;
  changedFilesCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PageSeoSettings {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  canonicalEnabled: boolean;
  canonicalUrl: string;
  redirectEnabled: boolean;
  redirectUrl: string;
  redirectType: "301" | "302";
  indexing: "index" | "noindex";
  linkFollowing: "follow" | "nofollow";
  includeInSitemap: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  /** Blog posts only — the featured image shown in blog listings/cards and its accessibility alt text. */
  blogImage: string;
  blogImageAlt: string;
  structuredData: string;
  headCode: string;
  bodyCode: string;
  footerCode: string;
}

export interface PageTreeNode {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  draftVersionId: string | null;
  publishedVersionId: string | null;
  isHomePage: boolean;
  children: PageTreeNode[];
}

export interface PageVersionSummary {
  id: string;
  pageId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdBy: string;
  createdAt: string;
}

export interface PageVersionDetail extends PageVersionSummary {
  content: unknown;
}
