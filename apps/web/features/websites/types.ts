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
  title: string;
  slug: string;
  templateId: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  draftVersionId: string | null;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
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
