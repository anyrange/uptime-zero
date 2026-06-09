import type { Hono } from "hono";

import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { recordPushHeartbeat } from "@/server/durable/scheduler-actor";

export function registerPushRoutes(app: Hono<AppEnv>) {
  app.post("/api/push/:token", async (ctx) => {
    ctx.get("log").set({
      action: "push_heartbeat",
      monitor: {
        tokenSuffix: ctx.req.param("token").slice(-8),
      },
    });

    const db = createDatabase(ctx.env.DB);
    const monitor = await db.monitor.getByPushToken(ctx.req.param("token"));

    if (!monitor) {
      throw new HTTPException(404, { message: "Heartbeat monitor not found" });
    }
    await recordPushHeartbeat(ctx.env, monitor.id, "push");

    return ctx.json({ ok: true });
  });
}
