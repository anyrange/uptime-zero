import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

export const requireApiSession = createMiddleware<AppEnv>(async (ctx, next) => {
  if (!ctx.get("sessionUserId")) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  await next();
});

export const requireApiAdmin = createMiddleware<AppEnv>(async (ctx, next) => {
  if (!ctx.get("sessionUserId")) {
    throw new HTTPException(401, { message: "Authentication required" });
  }
  if (ctx.get("sessionUserRole") !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
  await next();
});
