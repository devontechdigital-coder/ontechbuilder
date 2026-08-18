import type { Request } from "express";
import type { MembershipRole } from "../../core/database/database.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface ActiveTenantContext {
  id: string;
  role: MembershipRole;
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    sessionId: string;
    user: AuthenticatedUser;
    activeTenant: ActiveTenantContext | null;
  };
}

export interface SafeUserResponse {
  id: string;
  email: string;
  displayName: string | null;
}
