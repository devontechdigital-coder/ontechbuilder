import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { describe, expect, it, vi } from "vitest";
import { AuthGuard } from "./auth.guard.js";
import { RolesGuard } from "./roles.guard.js";
import { REQUIRED_ROLES_KEY } from "./roles.decorator.js";
import { TenantContextGuard } from "./tenant-context.guard.js";

function contextWithRequest(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe("AuthGuard", () => {
  it("denies unauthenticated access", async () => {
    const guard = new AuthGuard({
      getCookieValue: vi.fn().mockReturnValue(null),
      resolveSession: vi.fn().mockResolvedValue(null),
    } as never);

    await expect(guard.canActivate(contextWithRequest({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe("TenantContextGuard", () => {
  it("prevents tenant context spoofing", () => {
    const guard = new TenantContextGuard();

    expect(() =>
      guard.canActivate(
        contextWithRequest({
          params: {
            tenantId: "tenant-b",
          },
          auth: {
            user: { id: "user-a" },
            activeTenant: {
              id: "tenant-a",
              role: MembershipRole.OWNER,
            },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});

describe("RolesGuard", () => {
  it("allows owner access to admin routes", () => {
    const guard = new RolesGuard({
      getAllAndOverride: vi.fn((key: string) =>
        key === REQUIRED_ROLES_KEY ? [MembershipRole.ADMIN] : undefined,
      ),
    } as never);

    expect(
      guard.canActivate(
        contextWithRequest({
          auth: {
            activeTenant: {
              id: "tenant-a",
              role: MembershipRole.OWNER,
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it("allows admin access to admin routes and viewer access to viewer routes", () => {
    const adminGuard = new RolesGuard({
      getAllAndOverride: vi.fn(() => [MembershipRole.ADMIN]),
    } as never);

    expect(
      adminGuard.canActivate(
        contextWithRequest({
          auth: {
            activeTenant: {
              id: "tenant-a",
              role: MembershipRole.ADMIN,
            },
          },
        }),
      ),
    ).toBe(true);

    const viewerGuard = new RolesGuard({
      getAllAndOverride: vi.fn(() => [MembershipRole.VIEWER]),
    } as never);

    expect(
      viewerGuard.canActivate(
        contextWithRequest({
          auth: {
            activeTenant: {
              id: "tenant-a",
              role: MembershipRole.VIEWER,
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it("denies editor and viewer access to admin routes", () => {
    const guard = new RolesGuard({
      getAllAndOverride: vi.fn(() => [MembershipRole.ADMIN]),
    } as never);

    expect(() =>
      guard.canActivate(
        contextWithRequest({
          auth: {
            activeTenant: {
              id: "tenant-a",
              role: MembershipRole.EDITOR,
            },
          },
        }),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(
        contextWithRequest({
          auth: {
            activeTenant: {
              id: "tenant-a",
              role: MembershipRole.VIEWER,
            },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
