import { zValidator } from "@hono/zod-validator";
import { all } from "better-all";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import {
  MIN_MONITOR_INTERVAL_SEC,
  monitorConfigObjectSchema,
  parseMonitorConfigForStorage,
} from "@/lib/monitor/config";
import { createDatabase } from "@/server/db";
import { queueSchedulerSync } from "@/server/durable/scheduler-actor";
import { requireApiPermission } from "@/server/middleware/permissions";

const retentionInputSchema = z.object({
  heartbeatRetentionDays: z.coerce.number().int().min(1),
  incidentRetentionDays: z.coerce.number().int().min(1),
});

const monitorImportItemSchema = monitorConfigObjectSchema
  .extend({
    intervalSec: z.coerce
      .number()
      .int()
      .min(1)
      .default(MIN_MONITOR_INTERVAL_SEC),
  })
  .omit({
    notificationDestinationIds: true,
  });

const monitorImportSchema = z.object({
  kind: z.literal("uptime-monitor-export"),
  version: z.literal(1),
  exportedAt: z.string(),
  monitors: z.array(monitorImportItemSchema).min(1),
});

export const settingsApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const {
      settings,
      monitors,
      openIncidentCount,
      statusPages,
      statusPageLinks,
      notificationDestinations,
    } = await all({
      settings: () => db.settings.get(),
      monitors: () => db.monitor.listAll(),
      openIncidentCount: () => db.incident.countOpen(),
      statusPages: () => db.statusPage.list(),
      statusPageLinks: () => db.statusPage.listLinks(),
      notificationDestinations: () => db.notification.listRecords(),
    });

    return ctx.json({
      settings,
      monitors,
      openIncidentCount,
      statusPages,
      statusPageLinks,
      notificationDestinations,
    });
  })
  .get(
    "/monitors/export",
    requireApiPermission("monitor.export"),
    async (ctx) => {
      const db = createDatabase(ctx.env.DB);

      const monitors = await db.monitor.listAll();

      return ctx.json(
        {
          kind: "uptime-monitor-export",
          version: 1,
          exportedAt: new Date().toISOString(),
          monitors: monitors.map((monitor) => ({
            name: monitor.name,
            kind: monitor.kind,
            target: monitor.target,
            intervalSec: monitor.intervalSec,
            timeoutMs: monitor.timeoutMs,
            retries: monitor.retries,
            assertions: monitor.assertions,
            heartbeatMode: monitor.heartbeatMode,
            heartbeatCron: monitor.heartbeatCron,
            heartbeatGraceSec: monitor.heartbeatGraceSec,
            heartbeatTimezone: monitor.heartbeatTimezone,
            notificationGraceSec: monitor.notificationGraceSec,
            active: monitor.active === 1,
          })),
        },
        200,
        {
          "content-disposition": `attachment; filename="uptime-monitors-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      );
    },
  )
  .post(
    "/monitors/import",
    requireApiPermission("monitor.import"),
    zValidator("json", monitorImportSchema),
    async (ctx) => {
      const body = ctx.req.valid("json");

      const db = createDatabase(ctx.env.DB);

      const savedMonitors = [];
      for (const item of body.monitors) {
        const monitorConfig = monitorConfigObjectSchema.parse({
          ...item,
          intervalSec: Math.max(item.intervalSec, MIN_MONITOR_INTERVAL_SEC),
          notificationDestinationIds: [],
        });
        const savedMonitor = await db.monitor.createOrUpdate({
          ...parseMonitorConfigForStorage(monitorConfig),
          notificationDestinationIds: [],
        });
        if (!savedMonitor) {
          throw new HTTPException(500, { message: "Failed to import monitor" });
        }
        savedMonitors.push(savedMonitor);
      }

      queueSchedulerSync(ctx, "monitor-import");

      return ctx.json({
        imported: savedMonitors.length,
        monitors: savedMonitors,
      });
    },
  )
  .put(
    "/retention",
    requireApiPermission("settings.updateRetention"),
    zValidator("json", retentionInputSchema),
    async (ctx) => {
      const body = ctx.req.valid("json");

      const db = createDatabase(ctx.env.DB);

      const settings = await db.settings.update({
        heartbeatRetentionDays: body.heartbeatRetentionDays,
        incidentRetentionDays: body.incidentRetentionDays,
      });

      return ctx.json(settings);
    },
  );
