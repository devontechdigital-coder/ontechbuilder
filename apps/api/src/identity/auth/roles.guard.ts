import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MembershipRole } from "../../core/database/database.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { REQUIRED_ROLES_KEY } from "./roles.decorator.js";

const roleRank: Record<MembershipRole, number> = {
  [MembershipRole.VIEWER]: 1,
  [MembershipRole.EDITOR]: 2,
  [MembershipRole.ADMIN]: 3,
  [MembershipRole.OWNER]: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const activeTenant = request.auth?.activeTenant;

    if (!activeTenant) {
      throw new ForbiddenException("An active tenant is required");
    }

    const userRank = roleRank[activeTenant.role];
    const allowed = requiredRoles.some((role) => userRank >= roleRank[role]);

    if (!allowed) {
      throw new ForbiddenException("Insufficient tenant role");
    }

    return true;
  }
}
