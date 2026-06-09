import type { Hono } from "hono";

import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { createAppDb } from "@/api/db";

export function registerPushRoutes(app: Hono<AppEnv>) {
  app.post("/api/push/:token", async (ctx) => {
    ctx.get("log").set({
      action: "push_heartbeat",
      monitor: {
        tokenSuffix: ctx.req.param("token").slice(-8),
      },
    });
    const db = createAppDb(ctx.env.DB);
    const monitor = await db.monitor.getByPushToken(ctx.req.param("token"));
    if (!monitor) {
      throw new HTTPException(404, { message: "Heartbeat monitor not found" });
    }
    await db.lifecycle.recordPushHeartbeat(monitor);
    return ctx.json({ ok: true });
  });
}
