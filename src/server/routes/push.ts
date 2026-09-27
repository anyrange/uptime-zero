import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { recordPushHeartbeat } from "@/server/durable/scheduler-actor";

// Push URLs carry the monitor token, so request auto-logging skips this subtree
// (see `src/server/index.ts`) and the handler logs a redacted event instead.
export const pushApi = new Hono<AppEnv>().post("/:token", async (ctx) => {
  const token = ctx.req.param("token");

  const logger = ctx.get("logger").withContext({
    monitor: { tokenSuffix: token.slice(-8) },
  });

  const db = createDatabase(ctx.env.DB);
  const monitor = await db.monitor.getByPushToken(token);

  if (!monitor) {
    throw new HTTPException(404, { message: "Heartbeat monitor not found" });
  }

  await recordPushHeartbeat(ctx.env, monitor.id, "push");

  logger
    .withMetadata({ monitorId: monitor.id })
    .info("push heartbeat recorded");

  return ctx.json({ ok: true });
});
