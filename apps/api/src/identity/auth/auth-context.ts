import { UnauthorizedException } from "@nestjs/common";
import type { ActiveTenantContext, AuthenticatedRequest, AuthenticatedUser } from "./auth.types.js";

export function getAuthenticatedUser(request: AuthenticatedRequest): AuthenticatedUser {
  if (!request.auth?.user) {
    throw new UnauthorizedException("Authentication is required");
  }

  return request.auth.user;
}

export function getActiveTenant(request: AuthenticatedRequest): ActiveTenantContext {
  if (!request.auth?.activeTenant) {
    throw new UnauthorizedException("An active tenant is required");
  }

  return request.auth.activeTenant;
}
