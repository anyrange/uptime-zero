import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HTTPException } from "hono/http-exception";

import { loadSession, requireAdmin, requireSession } from "@/server/middleware/auth";
import { requireApiAdmin, requireApiSession } from "@/server/middleware/guards";
import { requireApiPermission } from "@/server/middleware/permissions";

const getSessionMock = vi.fn();
const getUserRoleMock = vi.fn();

vi.mock("@/server/lib/auth", () => ({
  authFor: vi.fn(() => ({
    api: {
      getSession: getSessionMock,
    },
  })),
}));

const createDatabaseMock = vi.fn(() => ({
  user: {
    getUserRole: getUserRoleMock,
  },
}));

vi.mock("@/server/db", () => ({
  createDatabase: createDatabaseMock,
}));

function createContext(base: Record<string, unknown> = {}) {
  const values = new Map<string, unknown>(Object.entries(base));
  const log = { set: vi.fn() };
  return {
    values,
    log,
    ctx: {
      req: {
        raw: {
          headers: new Headers(),
        },
      },
      env: {
        DB: {} as Record<string, never>,
      },
      get: (key: string) => {
        if (key === "log") return log;
        return values.has(key) ? values.get(key) ?? null : null;
      },
      set: (key: string, value: unknown) => {
        values.set(key, value);
      },
    },
  };
}

describe("auth and permission middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous users in page middleware", async () => {
    const next = vi.fn();
    const { ctx } = createContext();

    const response = (await requireSession(ctx as any, next)) as Response;

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    expect(next).not.toHaveBeenCalled();
  });

  it("lets authenticated users through in page middleware", async () => {
    const next = vi.fn();
    const { ctx } = createContext({ sessionUserId: "user-1" });

    await requireSession(ctx as any, next);

    expect(next).toHaveBeenCalled();
  });

  it("redirects unauthenticated users from admin page middleware", async () => {
    const next = vi.fn();
    const { ctx } = createContext();

    const response = (await requireAdmin(ctx as any, next)) as Response;

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects non-admin users in page middleware with 403", async () => {
    const next = vi.fn();
    const { ctx } = createContext({ sessionUserId: "user-1", sessionUserRole: "user" });

    await expect(requireAdmin(ctx as any, next)).rejects.toMatchObject({
      status: 403,
      message: "Admin access required",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("loads session values and role from authenticated session", async () => {
    const next = vi.fn();
    const { ctx, values, log } = createContext();

    getSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Session User",
        email: "session@example.com",
        image: "https://example.com/avatar.png",
      },
    });
    getUserRoleMock.mockResolvedValue("admin");

    await loadSession(ctx as any, next);

    expect(values.get("sessionUserId")).toBe("user-1");
    expect(values.get("sessionUserName")).toBe("Session User");
    expect(values.get("sessionUserEmail")).toBe("session@example.com");
    expect(values.get("sessionUserImage")).toBe("https://example.com/avatar.png");
    expect(values.get("sessionUserRole")).toBe("admin");
    expect(getUserRoleMock).toHaveBeenCalledWith("user-1");
    expect(log.set).toHaveBeenCalledWith({
      session: { userId: "user-1" },
    });
    expect(next).toHaveBeenCalled();
  });

  it("loads null session context when no user is signed in", async () => {
    const next = vi.fn();
    const { ctx, values, log } = createContext();

    getSessionMock.mockResolvedValue(null);

    await loadSession(ctx as any, next);

    expect(values.get("sessionUserId")).toBeNull();
    expect(values.get("sessionUserName")).toBeNull();
    expect(values.get("sessionUserEmail")).toBeNull();
    expect(values.get("sessionUserImage")).toBeNull();
    expect(values.get("sessionUserRole")).toBeNull();
    expect(log.set).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(getUserRoleMock).not.toHaveBeenCalled();
  });

  it("rejects anonymous API requests", async () => {
    const next = vi.fn();
    const { ctx } = createContext();

    await expect(requireApiSession(ctx as any, next)).rejects.toBeInstanceOf(
      HTTPException,
    );
  });

  it("allows API sessions with authenticated users", async () => {
    const next = vi.fn();
    const { ctx } = createContext({ sessionUserId: "api-user" });

    await requireApiSession(ctx as any, next);

    expect(next).toHaveBeenCalled();
  });

  it("rejects anonymous users in permission middleware", async () => {
    const next = vi.fn();
    const { ctx } = createContext();

    await expect(
      requireApiPermission("monitor.read")(ctx as any, next),
    ).rejects.toMatchObject({
      status: 401,
      message: "Authentication required",
    });
  });

  it("rejects non-admin API calls with 403", async () => {
    const next = vi.fn();
    const { ctx } = createContext({ sessionUserId: "api-user", sessionUserRole: "user" });

    await expect(requireApiAdmin(ctx as any, next)).rejects.toMatchObject({
      status: 403,
      message: "Admin access required",
    });
  });

  it("allows API admins", async () => {
    const next = vi.fn();
    const { ctx } = createContext({
      sessionUserId: "api-admin",
      sessionUserRole: "admin",
    });

    await requireApiAdmin(ctx as any, next);

    expect(next).toHaveBeenCalled();
  });

  it("enforces monitor permissions for API callers", async () => {
    const next = vi.fn();
    const monitorUser = createContext({
      sessionUserId: "api-user",
      sessionUserRole: "user",
    });
    const monitorAdmin = createContext({
      sessionUserId: "api-admin",
      sessionUserRole: "admin",
    });
    const accountRead = createContext({
      sessionUserId: "api-user",
      sessionUserRole: "user",
    });

    await expect(
      requireApiPermission("monitor.delete")(monitorUser.ctx as any, next),
    ).rejects.toMatchObject({ status: 403, message: "Permission denied" });
    expect(next).not.toHaveBeenCalled();

    await requireApiPermission("monitor.read")(monitorAdmin.ctx as any, next);
    expect(next).toHaveBeenCalled();

    await requireApiPermission("account.read")(accountRead.ctx as any, next);
    expect(next).toHaveBeenCalled();
  });
});
