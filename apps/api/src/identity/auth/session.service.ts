import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";
import type { Response } from "express";
import { type AppConfig } from "../../core/config/config.js";
import { MembershipStatus } from "../../core/database/database.js";
import { APP_CONFIG } from "../../core/config/config.provider.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import type { ActiveTenantContext, AuthenticatedUser } from "./auth.types.js";

export interface ResolvedSession {
  sessionId: string;
  user: AuthenticatedUser;
  activeTenant: ActiveTenantContext | null;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  createToken(): string {
    return randomBytes(32).toString("base64url");
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  getCookieName(): string {
    return this.config.SESSION_COOKIE_NAME;
  }

  getCookieValue(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const prefix = `${this.getCookieName()}=`;
    const sessionCookie = cookies.find((cookie) => cookie.startsWith(prefix));

    return sessionCookie ? decodeURIComponent(sessionCookie.slice(prefix.length)) : null;
  }

  async createSession(
    userId: string,
    activeTenantId: string | null,
  ): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    const token = this.createToken();
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        activeTenantId,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async resolveSession(token: string | null): Promise<ResolvedSession | null> {
    if (!token) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash: this.hashToken(token),
      },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        activeTenantId: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    const activeTenant = session.activeTenantId
      ? await this.resolveActiveTenant(session.user.id, session.activeTenantId)
      : null;

    return {
      sessionId: session.id,
      user: session.user,
      activeTenant,
    };
  }

  async revokeSession(token: string | null): Promise<void> {
    if (!token) {
      return;
    }

    await this.prisma.session.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async setActiveTenant(
    sessionId: string,
    userId: string,
    tenantId: string,
  ): Promise<ActiveTenantContext> {
    const activeTenant = await this.resolveActiveTenant(userId, tenantId);

    if (!activeTenant) {
      throw new ForbiddenException("User does not have access to this tenant");
    }

    await this.prisma.session.update({
      where: {
        id: sessionId,
      },
      data: {
        activeTenantId: tenantId,
      },
    });

    return activeTenant;
  }

  writeCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(this.getCookieName(), token, {
      httpOnly: true,
      secure: this.config.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });
  }

  clearCookie(response: Response): void {
    response.clearCookie(this.getCookieName(), {
      httpOnly: true,
      secure: this.config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }

  private async resolveActiveTenant(
    userId: string,
    tenantId: string,
  ): Promise<ActiveTenantContext | null> {
    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      select: {
        role: true,
        status: true,
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      return null;
    }

    return {
      id: tenantId,
      role: membership.role,
    };
  }
}
