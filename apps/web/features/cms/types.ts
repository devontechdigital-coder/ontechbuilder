export type ContentFieldType = "TEXT" | "RICH_TEXT" | "NUMBER" | "BOOLEAN" | "DATE" | "IMAGE" | "URL";
export type ContentEntryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ContentField {
  id: string;
  contentTypeId: string;
  name: string;
  slug: string;
  type: ContentFieldType;
  required: boolean;
  position: number;
  configuration: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentTypeSummary {
  id: string;
  tenantId: string;
  websiteId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  fields?: ContentField[];
  _count?: {
    fields: number;
    entries: number;
  };
}

export interface ContentEntry {
  id: string;
  tenantId: string;
  websiteId: string;
  contentTypeId: string;
  status: ContentEntryStatus;
  data: Record<string, unknown>;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentEntryVersion {
  id: string;
  entryId: string;
  versionNumber: number;
  status: string;
  createdBy: string;
  createdAt: string;
}
