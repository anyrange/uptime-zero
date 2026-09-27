import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { recordPushHeartbeat } from "@/server/durable/scheduler-actor";

export const pushApi = new Hono<AppEnv>()
  // Push tokens are credentials; keep raw paths out of request logs, including unmatched methods.
  .use(async (ctx, next) => {
    ctx.get("log").set({ path: "/api/push/:token" });
    await next();
  })
  .post("/:token", async (ctx) => {
    const token = ctx.req.param("token");

    ctx.get("log").set({
      action: "push_heartbeat",
      monitor: {
        tokenSuffix: token.slice(-8),
      },
    });

    const db = createDatabase(ctx.env.DB);
    const monitor = await db.monitor.getByPushToken(token);

    if (!monitor) {
      throw new HTTPException(404, { message: "Heartbeat monitor not found" });
    }

    await recordPushHeartbeat(ctx.env, monitor.id, "push");

    return ctx.json({ ok: true });
  });
