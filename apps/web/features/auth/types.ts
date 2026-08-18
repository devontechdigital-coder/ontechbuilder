export interface SafeUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface ActiveTenant {
  id: string;
  role: string;
}
