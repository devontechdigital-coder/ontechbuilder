import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service.js";
import { AuthGuard } from "./auth.guard.js";
import { getAuthenticatedUser } from "./auth-context.js";
import { SessionService } from "./session.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Post("register")
  async register(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = body as Record<string, unknown>;
    const result = await this.auth.register({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      tenantName: input.tenantName,
      tenantSlug: input.tenantSlug,
    });

    this.sessions.writeCookie(response, result.session.token, result.session.expiresAt);

    return {
      user: result.user,
    };
  }

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = body as Record<string, unknown>;
    const result = await this.auth.login({
      email: input.email,
      password: input.password,
    });

    this.sessions.writeCookie(response, result.session.token, result.session.expiresAt);

    return {
      user: result.user,
    };
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revokeSession(this.sessions.getCookieValue(request.headers.cookie));
    this.sessions.clearCookie(response);

    return {
      ok: true,
    };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: getAuthenticatedUser(request),
      activeTenant: request.auth?.activeTenant ?? null,
    };
  }
}
