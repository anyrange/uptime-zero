import { env } from "cloudflare:workers";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  loadSession,
  requireAdmin,
  requireSession,
} from "@/server/middleware/auth";
import { requireApiAdmin, requireApiSession } from "@/server/middleware/guards";
import { requireApiPermission } from "@/server/middleware/permissions";

import { testAuth } from "./api-test-utils";

type SessionVars = {
  sessionUserId: string | null;
  sessionUserRole: "admin" | "user" | null;
  sessionUserName: string | null;
  sessionUserEmail: string | null;
  sessionUserImage: string | null;
};

type TestLog = { set: ReturnType<typeof vi.fn> };
type ContextValue = SessionVars[keyof SessionVars] | TestLog | null;

type Context = Parameters<typeof requireSession>[0] & {
  req: {
    raw: {
      headers: Headers;
    };
    url: string;
  };
  env: { DB: Record<string, never> };
  redirect: (location: string) => Response;
  get: (key: keyof SessionVars | "log") => ContextValue;
  set: (
    key: keyof SessionVars,
    value: SessionVars[keyof SessionVars] | null,
  ) => void;
};

type TestContext = {
  ctx: Context;
  next: Mock<() => Promise<void>>;
  values: Map<string, unknown>;
  log: TestLog;
};

async function createAuthSession(role: "admin" | "user") {
  const { test } = await testAuth.$context;
  const user = test.createUser({
    name: role === "admin" ? "Admin" : "User",
    email: `${role}-${crypto.randomUUID()}@example.com`,
    role,
  });
  await test.saveUser(user);
  const headers = await test.getAuthHeaders({ userId: user.id });
  const cookie = headers.get("cookie");

  if (!cookie) {
    throw new Error("Failed to create test auth session");
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    cookie,
  };
}

function createContext(
  seed: Partial<SessionVars> = {},
  headers = new Headers(),
): TestContext {
  const values = new Map<string, unknown>([
    ["sessionUserId", null],
    ["sessionUserRole", null],
    ["sessionUserName", null],
    ["sessionUserEmail", null],
    ["sessionUserImage", null],
    ...Object.entries(seed),
  ]);
  const log = { set: vi.fn() };

  // SAFETY: The test double implements the middleware-visible subset of Hono's context.
  const ctx = {
    req: {
      raw: {
        headers,
      },
      url: "http://localhost/test",
    },
    env: {
      DB: env.DB,
    },
    redirect: (location: string) =>
      new Response(null, {
        status: 302,
        headers: { Location: location },
      }),
    get: (key: keyof SessionVars | "log") => {
      if (key === "log") {
        return log;
      }
      if (!values.has(key)) {
        return null;
      }
      return values.get(key) ?? null;
    },
    set: (
      key: keyof SessionVars,
      value: SessionVars[keyof SessionVars] | null,
    ) => {
      values.set(key, value);
    },
  } as Context;

  return {
    ctx,
    next: vi.fn<() => Promise<void>>(async () => {}),
    values,
    log,
  };
}

function runMiddleware(
  middleware: (
    ctx: Context,
    next: () => Promise<void>,
  ) => Promise<Response | void>,
  ctx: Context,
  next: () => Promise<void>,
): Promise<Response | void> {
  return middleware(ctx, next);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadSession", () => {
  it("hydrates context from an authenticated session", async () => {
    const { cookie, userId, name, email } = await createAuthSession("admin");
    const { ctx, next, values, log } = createContext(
      {},
      new Headers({ cookie }),
    );

    await runMiddleware(loadSession, ctx, next);

    expect(values.get("sessionUserId")).toBe(userId);
    expect(values.get("sessionUserName")).toBe(name);
    expect(values.get("sessionUserRole")).toBe("admin");
    expect(values.get("sessionUserEmail")).toBe(email);
    expect(log.set).toHaveBeenCalledWith({
      session: {
        userId,
      },
    });
    expect(next).toHaveBeenCalled();
  });

  it("clears context when no session exists", async () => {
    const { ctx, next, values, log } = createContext();

    await runMiddleware(loadSession, ctx, next);

    expect(values.get("sessionUserId")).toBeNull();
    expect(values.get("sessionUserName")).toBeNull();
    expect(values.get("sessionUserEmail")).toBeNull();
    expect(values.get("sessionUserImage")).toBeNull();
    expect(values.get("sessionUserRole")).toBeNull();
    expect(log.set).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

describe("page middleware", () => {
  it("redirects anonymous users", async () => {
    const { ctx, next } = createContext();

    // SAFETY: Anonymous page middleware returns its redirect response on this branch.
    const response = (await runMiddleware(
      requireSession,
      ctx,
      next,
    )) as Response;

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    expect(next).not.toHaveBeenCalled();
  });

  it("allows users with an active session", async () => {
    const { ctx, next } = createContext({
      sessionUserId: "user-1",
    });

    await runMiddleware(requireSession, ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("requires admin for admin pages", async () => {
    const anonymous = createContext();
    // SAFETY: Anonymous admin middleware returns its redirect response on this branch.
    const anonymousResponse = (await runMiddleware(
      requireAdmin,
      anonymous.ctx,
      anonymous.next,
    )) as Response;
    expect(anonymousResponse).toBeInstanceOf(Response);
    expect(anonymousResponse.headers.get("Location")).toBe("/login");
    expect(anonymous.next).not.toHaveBeenCalled();

    const regular = createContext({
      sessionUserId: "user-1",
      sessionUserRole: "user",
    });
    await expect(
      runMiddleware(requireAdmin, regular.ctx, regular.next),
    ).rejects.toMatchObject({
      status: 403,
      message: "Admin access required",
    });
    expect(regular.next).not.toHaveBeenCalled();

    const admin = createContext({
      sessionUserId: "user-2",
      sessionUserRole: "admin",
    });
    await runMiddleware(requireAdmin, admin.ctx, admin.next);
    expect(admin.next).toHaveBeenCalled();
  });
});

describe("API middleware", () => {
  it("requires authentication for API sessions", async () => {
    const { ctx, next } = createContext();

    await expect(
      runMiddleware(requireApiSession, ctx, next),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it("passes API sessions with a session user id", async () => {
    const { ctx, next } = createContext({
      sessionUserId: "api-user",
      sessionUserRole: "user",
    });

    await runMiddleware(requireApiSession, ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("requires admin role for admin API routes", async () => {
    const regular = createContext({
      sessionUserId: "api-user",
      sessionUserRole: "user",
    });

    await expect(
      runMiddleware(requireApiAdmin, regular.ctx, regular.next),
    ).rejects.toMatchObject({
      status: 403,
      message: "Admin access required",
    });

    const admin = createContext({
      sessionUserId: "api-admin",
      sessionUserRole: "admin",
    });
    await runMiddleware(requireApiAdmin, admin.ctx, admin.next);
    expect(admin.next).toHaveBeenCalled();
  });

  it("enforces permission profiles for API routes", async () => {
    const anonymous = createContext();
    await expect(
      runMiddleware(
        requireApiPermission("monitor.delete"),
        anonymous.ctx,
        anonymous.next,
      ),
    ).rejects.toMatchObject({
      status: 401,
      message: "Authentication required",
    });

    const user = createContext({
      sessionUserId: "api-user",
      sessionUserRole: "user",
    });
    await expect(
      runMiddleware(
        requireApiPermission("monitor.delete"),
        user.ctx,
        user.next,
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: "Permission denied",
    });

    const readAllowed = createContext({
      sessionUserId: "api-user",
      sessionUserRole: "user",
    });
    await runMiddleware(
      requireApiPermission("account.read"),
      readAllowed.ctx,
      readAllowed.next,
    );
    expect(readAllowed.next).toHaveBeenCalled();

    const admin = createContext({
      sessionUserId: "api-admin",
      sessionUserRole: "admin",
    });
    await runMiddleware(
      requireApiPermission("monitor.delete"),
      admin.ctx,
      admin.next,
    );
    expect(admin.next).toHaveBeenCalled();
  });
});
