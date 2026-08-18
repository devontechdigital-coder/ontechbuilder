import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.auth?.user) {
      throw new UnauthorizedException("Authentication is required");
    }

    if (!request.auth.activeTenant) {
      throw new ForbiddenException("An active tenant is required");
    }

    const requestedTenantId = request.params.tenantId;

    if (requestedTenantId && requestedTenantId !== request.auth.activeTenant.id) {
      throw new ForbiddenException("Requested tenant does not match the active tenant");
    }

    return true;
  }
}
