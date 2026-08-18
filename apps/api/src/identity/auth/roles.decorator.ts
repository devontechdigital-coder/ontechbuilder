import { SetMetadata } from "@nestjs/common";
import type { MembershipRole } from "../../core/database/database.js";

export const REQUIRED_ROLES_KEY = "requiredRoles";

export function RequireRole(...roles: MembershipRole[]) {
  return SetMetadata(REQUIRED_ROLES_KEY, roles);
}
