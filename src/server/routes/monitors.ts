import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import {
  monitorConfigSchema,
  parseMonitorConfigForStorage,
} from "@/lib/monitor/config";
import { m } from "@/paraglide/messages.js";
import { createDatabase } from "@/server/db";
import {
  queueSchedulerForSavedMonitor,
  queueSchedulerSync,
  runMonitorNow,
} from "@/server/durable/scheduler-actor";
import { runConfiguredMonitorCheck } from "@/server/lib/monitoring";
import { requireApiPermission } from "@/server/middleware/permissions";
import { MonitorService } from "@/server/services/monitor";

const monitorLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});

export const monitorsApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const monitorService = new MonitorService(db);

    const listData = await monitorService.getListData();

    return ctx.json(listData);
  })
  .post(
    "/",
    requireApiPermission("monitor.create"),
    zValidator("json", monitorConfigSchema),
    async (ctx) => {
      const monitor = parseMonitorConfigForStorage(ctx.req.valid("json"));

      ctx.get("log").set({
        action: "monitor_create",
        monitor: {
          kind: monitor.kind,
          name: monitor.name,
          intervalSec: monitor.intervalSec,
        },
      });
      const db = createDatabase(ctx.env.DB);

      const savedMonitor = await db.monitor.create(monitor);

      if (!savedMonitor) {
        throw new HTTPException(404, { message: "Monitor not found" });
      }

      if (savedMonitor.active === 1 && savedMonitor.kind !== "push") {
        await runMonitorNow(ctx.env, savedMonitor.id, "save");
      } else {
        queueSchedulerSync(ctx, "monitor-save");
      }

      return ctx.json(savedMonitor, 201);
    },
  )
  .post(
    "/test",
    requireApiPermission("monitor.create"),
    zValidator("json", monitorConfigSchema),
    async (ctx) => {
      const monitor = parseMonitorConfigForStorage(ctx.req.valid("json"));

      if (monitor.kind === "push") {
        throw new HTTPException(400, {
          message: m.monitor_test_push_unavailable(),
        });
      }

      const result = await runConfiguredMonitorCheck(monitor);
      ctx.get("log").set({
        action: "monitor_test",
        monitor: {
          kind: monitor.kind,
          name: monitor.name,
        },
        check: {
          status: result.status,
          statusCode: result.statusCode,
          durationMs: result.durationMs,
        },
      });

      return ctx.json({
        status: result.status,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        error: result.error,
      });
    },
  )
  .get("/state/:id", async (ctx) => {
    const monitor = await createDatabase(ctx.env.DB).monitor.getById(
      ctx.req.param("id"),
    );

    if (!monitor) {
      throw new HTTPException(404, { message: "Monitor not found" });
    }

    return ctx.json(monitor);
  })
  .get("/:id", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const monitorService = new MonitorService(db);

    const detail = await monitorService.getDetailData(ctx.req.param("id"));

    if (!detail) {
      throw new HTTPException(404, { message: "Monitor not found" });
    }

    return ctx.json(detail);
  })
  .get(
    "/:id/logs",
    zValidator("query", monitorLogsQuerySchema),
    async (ctx) => {
      const page = ctx.req.valid("query").page;

      const db = createDatabase(ctx.env.DB);

      const monitorService = new MonitorService(db);

      const detail = await monitorService.getHeartbeatPage(
        ctx.req.param("id"),
        page,
      );

      if (!detail) {
        throw new HTTPException(404, { message: "Monitor not found" });
      }

      return ctx.json(detail);
    },
  )
  .put(
    "/:id",
    requireApiPermission("monitor.update"),
    zValidator("json", monitorConfigSchema),
    async (ctx) => {
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

      const db = createDatabase(ctx.env.DB);

      const savedMonitor = await db.monitor.update(
        ctx.req.param("id"),
        monitor,
      );

      if (!savedMonitor) {
        throw new HTTPException(404, { message: "Monitor not found" });
      }

      queueSchedulerForSavedMonitor(ctx, savedMonitor, "monitor-resume");

      return ctx.json(savedMonitor);
    },
  )
  .delete("/:id", requireApiPermission("monitor.delete"), async (ctx) => {
    const monitorId = ctx.req.param("id");
    ctx.get("log").set({
      action: "monitor_delete",
      monitor: { id: monitorId },
    });

    const db = createDatabase(ctx.env.DB);

    await db.monitor.delete(monitorId);

    queueSchedulerSync(ctx, "monitor-delete");

    return ctx.json({ ok: true });
  })
  .post(
    "/:id/rotate-token",
    requireApiPermission("monitor.update"),
    async (ctx) => {
      const monitor = await createDatabase(ctx.env.DB).monitor.rotatePushToken(
        ctx.req.param("id"),
      );

      if (!monitor)
        throw new HTTPException(404, {
          message: "Heartbeat monitor not found",
        });

      return ctx.json(monitor);
    },
  )
  .post("/:id/pause", requireApiPermission("monitor.pause"), async (ctx) => {
    const monitorId = ctx.req.param("id");

    const db = createDatabase(ctx.env.DB);

    const savedMonitor = await db.monitor.setActive(monitorId, false);

    if (!savedMonitor) {
      throw new HTTPException(404, { message: "Monitor not found" });
    }

    queueSchedulerSync(ctx, "monitor-pause");

    return ctx.json(savedMonitor);
  })
  .post("/:id/resume", requireApiPermission("monitor.resume"), async (ctx) => {
    const monitorId = ctx.req.param("id");

    const db = createDatabase(ctx.env.DB);

    const savedMonitor = await db.monitor.setActive(monitorId, true);

    if (!savedMonitor) {
      throw new HTTPException(404, { message: "Monitor not found" });
    }

    queueSchedulerForSavedMonitor(ctx, savedMonitor, "monitor-update");

    return ctx.json(savedMonitor);
  });
