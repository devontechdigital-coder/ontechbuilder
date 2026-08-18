export interface PageResult<T> {
  data: T[];
  nextCursor: string | null;
}

export interface MediaSummary {
  id: string;
  tenantId: string;
  createdBy: string;
  originalFilename: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  storageProvider: string;
  bucket: string;
  access: "PRIVATE" | "PUBLIC";
  width: number | null;
  height: number | null;
  status: "READY" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface MediaUploadInitResponse {
  mediaId: string;
  storageKey: string;
  uploadToken: string;
  expiresInSeconds: number;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
  };
}

export interface MediaAccessResponse {
  media: MediaSummary;
  url: string;
  expiresInSeconds: number;
}
