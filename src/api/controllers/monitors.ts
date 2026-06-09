import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";
import type { MonitorRecord } from "@/types";

import { createAppDb } from "@/api/db";
import {
  queueSchedulerSync,
  runMonitorNow,
} from "@/api/durable/scheduler-actor";
import {
  monitorConfigSchema,
  parseMonitorConfigForStorage,
} from "@/lib/monitor-config";
import { normalizeMonitorLogsPage } from "@/lib/monitor-logs";

const monitorLogsQuerySchema = z.object({
  page: z.string().optional(),
});

export const monitorsApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    const listData = await db.monitor.getListData();

    return ctx.json(listData);
  })
  .post("/", zValidator("json", monitorConfigSchema), async (ctx) => {
    const monitor = parseMonitorConfigForStorage(ctx.req.valid("json"));
    ctx.get("log").set({
      action: "monitor_create",
      monitor: {
        kind: monitor.kind,
        name: monitor.name,
        intervalSec: monitor.intervalSec,
      },
    });
    const db = createAppDb(ctx.env.DB);
    const savedMonitor = await db.monitor.createOrUpdate(monitor);
    if (!savedMonitor) {
      throw new HTTPException(500, { message: "Failed to save monitor" });
    }
    await syncSavedMonitor(ctx, savedMonitor, "run");

    return ctx.json(savedMonitor, 201);
  })
  .get("/:id", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    const detail = await db.monitor.getDetailData(ctx.req.param("id"));
    if (!detail) {
      throw new HTTPException(404, { message: "Monitor not found" });
    }

    return ctx.json(detail);
  })
  .get(
    "/:id/logs",
    zValidator("query", monitorLogsQuerySchema),
    async (ctx) => {
      const page = readMonitorLogsPage(ctx.req.valid("query").page);
      const db = createAppDb(ctx.env.DB);
      const detail = await db.monitor.getHeartbeatPage(
        ctx.req.param("id"),
        page,
      );
      if (!detail) {
        throw new HTTPException(404, { message: "Monitor not found" });
      }

      return ctx.json(detail);
    },
  )
  .put("/:id", zValidator("json", monitorConfigSchema), async (ctx) => {
    const monitor = parseMonitorConfigForStorage(ctx.req.valid("json"));
    ctx.get("log").set({
      action: "monitor_update",
      monitor: {
        id: ctx.req.param("id"),
        kind: monitor.kind,
        name: monitor.name,
        intervalSec: monitor.intervalSec,
      },
    });
    const db = createAppDb(ctx.env.DB);
    const savedMonitor = await db.monitor.createOrUpdate({
      ...monitor,
      id: ctx.req.param("id"),
    });
    if (!savedMonitor) {
      throw new HTTPException(500, { message: "Failed to save monitor" });
    }
    await syncSavedMonitor(ctx, savedMonitor, "sync", "monitor-resume");

    return ctx.json(savedMonitor);
  })
  .delete("/:id", async (ctx) => {
    const monitorId = ctx.req.param("id");
    ctx.get("log").set({
      action: "monitor_delete",
      monitor: { id: monitorId },
    });
    const db = createAppDb(ctx.env.DB);
    await db.monitor.delete(monitorId);
    queueSchedulerSync(ctx, "monitor-delete");

    return ctx.json({ ok: true });
  })
  .post("/:id/pause", async (ctx) => {
    const monitorId = ctx.req.param("id");
    const db = createAppDb(ctx.env.DB);
    const savedMonitor = await db.monitor.createOrUpdate({
      id: monitorId,
      active: 0,
    });
    if (!savedMonitor) {
      throw new HTTPException(404, { message: "Monitor not found" });
    }
    queueSchedulerSync(ctx, "monitor-pause");

    return ctx.json(savedMonitor);
  })
  .post("/:id/resume", async (ctx) => {
    const monitorId = ctx.req.param("id");
    const db = createAppDb(ctx.env.DB);
    const savedMonitor = await db.monitor.createOrUpdate({
      id: monitorId,
      active: 1,
    });
    if (!savedMonitor) {
      throw new HTTPException(404, { message: "Monitor not found" });
    }
    await syncSavedMonitor(ctx, savedMonitor);

    return ctx.json(savedMonitor);
  })
  .post("/:id/run", async (ctx) => {
    const monitorId = ctx.req.param("id");
    const db = createAppDb(ctx.env.DB);
    const result = await runMonitorNow(ctx.env, monitorId, "manual");
    const detail = await db.monitor.getDetailData(monitorId);

    return ctx.json({ result, detail });
  });

export function readMonitorLogsPage(page: string | undefined) {
  return normalizeMonitorLogsPage(page);
}

async function syncSavedMonitor(
  ctx: {
    env: AppEnv["Bindings"];
    executionCtx: { waitUntil(promise: Promise<unknown>): void };
  },
  monitor: MonitorRecord,
  activeMode: "run" | "sync" = "sync",
  syncReason = "monitor-update",
) {
  if (monitor.active === 1) {
    if (activeMode === "run") {
      await runMonitorNow(ctx.env, monitor.id, "save");
      return;
    }
    queueSchedulerSync(ctx, syncReason);
    return;
  }

  queueSchedulerSync(ctx, "monitor-pause");
}
