import { describe, expect, it, vi } from "vitest";
import { AuthController } from "./auth.controller.js";
import type { AuthenticatedRequest } from "./auth.types.js";

describe("AuthController", () => {
  it("revokes and clears the session cookie on logout", async () => {
    const revokeSession = vi.fn().mockResolvedValue(undefined);
    const clearCookie = vi.fn();
    const controller = new AuthController(
      {} as never,
      {
        getCookieValue: vi.fn().mockReturnValue("session-token"),
        revokeSession,
        clearCookie,
      } as never,
    );

    await expect(
      controller.logout(
        {
          headers: {
            cookie: "stackbuilder_session=session-token",
          },
        } as AuthenticatedRequest,
        {} as never,
      ),
    ).resolves.toEqual({ ok: true });

    expect(revokeSession).toHaveBeenCalledWith("session-token");
    expect(clearCookie).toHaveBeenCalled();
  });

  it("returns the current user without session secrets", () => {
    const controller = new AuthController({} as never, {} as never);

    const response = controller.me({
      auth: {
        sessionId: "session-a",
        user: {
          id: "user-a",
          email: "user@example.com",
          displayName: "User",
        },
        activeTenant: {
          id: "tenant-a",
          role: "OWNER",
        },
      },
    } as AuthenticatedRequest);

    expect(response.user).toEqual({
      id: "user-a",
      email: "user@example.com",
      displayName: "User",
    });
    expect(JSON.stringify(response)).not.toContain("session-a");
    expect(JSON.stringify(response)).not.toContain("token");
  });
});
