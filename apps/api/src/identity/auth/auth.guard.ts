import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { SessionService } from "./session.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const token = this.sessions.getCookieValue(request.headers.cookie);
    const session = await this.sessions.resolveSession(token);

    if (!session) {
      throw new UnauthorizedException("Authentication is required");
    }

    request.auth = session;
    return true;
  }
}
