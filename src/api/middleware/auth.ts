import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { createAppDb } from "@/api/db";
import { authFor } from "@/api/lib/auth";

export const requireSession = createMiddleware<AppEnv>(async (ctx, next) => {
  if (!ctx.get("sessionUserId")) {
    return ctx.redirect("/login");
  }
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (ctx, next) => {
  if (!ctx.get("sessionUserId")) {
    return ctx.redirect("/login");
  }
  if (ctx.get("sessionUserRole") !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
  await next();
});

export const loadSession = createMiddleware<AppEnv>(async (ctx, next) => {
  const session = await authFor(ctx).api.getSession({
    headers: ctx.req.raw.headers,
  });

  ctx.set("sessionUserId", session?.user.id ?? null);
  ctx.set("sessionUserName", session?.user.name ?? null);
  ctx.set("sessionUserEmail", session?.user.email ?? null);
  ctx.set("sessionUserImage", session?.user.image ?? null);
  const db = createAppDb(ctx.env.DB);
  ctx.set(
    "sessionUserRole",
    session?.user.id ? await db.auth.getUserRole(session.user.id) : null,
  );

  if (session?.user.id) {
    ctx.get("log").set({
      session: {
        userId: session.user.id,
      },
    });
  }

  await next();
});
