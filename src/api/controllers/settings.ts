import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import { createAppDb } from "@/api/db";
import { runMonitorNow } from "@/api/durable/monitor-actor-client";
import {
  monitorConfigObjectSchema,
  parseMonitorConfigForStorage,
} from "@/lib/monitor-config";

const retentionInputSchema = z.object({
  heartbeatRetentionDays: z.coerce.number().int().min(1),
  incidentRetentionDays: z.coerce.number().int().min(1),
});

const monitorExportItemSchema = monitorConfigObjectSchema.omit({
  notificationDestinationIds: true,
});

const monitorImportSchema = z.object({
  kind: z.literal("uptime-monitor-export"),
  version: z.literal(1),
  exportedAt: z.string(),
  monitors: z.array(monitorExportItemSchema).min(1),
});

export const settingsApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    return ctx.json(await db.dashboard.get());
  })
  .get("/monitors/export", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    const dashboard = await db.dashboard.get();
    return ctx.json(
      {
        kind: "uptime-monitor-export",
        version: 1,
        exportedAt: new Date().toISOString(),
        monitors: dashboard.monitors.map((monitor) => ({
          name: monitor.name,
          kind: monitor.kind,
          target: monitor.target,
          intervalSec: monitor.intervalSec,
          timeoutMs: monitor.timeoutMs,
          retries: monitor.retries,
          assertions: monitor.assertions,
          active: monitor.active === 1,
        })),
      },
      200,
      {
        "content-disposition": `attachment; filename="uptime-monitors-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    );
  })
  .post(
    "/monitors/import",
    zValidator("json", monitorImportSchema),
    async (ctx) => {
      const body = ctx.req.valid("json");
      const db = createAppDb(ctx.env.DB);
      const savedMonitors = [];

      for (const item of body.monitors) {
        const savedMonitor = await db.monitor.createOrUpdate({
          ...parseMonitorConfigForStorage({
            ...item,
            notificationDestinationIds: [],
          }),
          notificationDestinationIds: [],
        });
        if (!savedMonitor) {
          throw new HTTPException(500, { message: "Failed to import monitor" });
        }
        savedMonitors.push(savedMonitor);
      }

      const activeMonitorIds = savedMonitors
        .filter((monitor) => monitor.active === 1)
        .map((monitor) => monitor.id);
      if (activeMonitorIds.length > 0) {
        ctx.executionCtx.waitUntil(
          Promise.all(
            activeMonitorIds.map((monitorId) =>
              runMonitorNow(ctx.env, monitorId, "monitor-import"),
            ),
          ),
        );
      }

      return ctx.json({
        imported: savedMonitors.length,
        monitors: savedMonitors,
      });
    },
  )
  .put("/retention", zValidator("json", retentionInputSchema), async (ctx) => {
    const body = ctx.req.valid("json");
    const db = createAppDb(ctx.env.DB);
    const settings = await db.settings.update({
      heartbeatRetentionDays: body.heartbeatRetentionDays,
      incidentRetentionDays: body.incidentRetentionDays,
    });
    return ctx.json(settings);
  });
