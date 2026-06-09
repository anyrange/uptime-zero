import { zValidator } from "@hono/zod-validator";
import { all } from "better-all";
import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { daysAgoIso, hoursAgoIso } from "@/server/lib/dates";
import { computeAggregateStatus } from "@/server/lib/monitoring";

const incidentFiltersSchema = z.object({
  status: z.enum(["open", "closed", "all"]).default("all"),
  monitor: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

const RECENT_DASHBOARD_HEARTBEAT_LIMIT = 10;

export const dashboardApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const {
      monitors,
      incidents,
      openIncidentCount,
      heartbeatCountLastHour,
      heartbeatCountLastDay,
      heartbeats,
      statusPages,
    } = await all({
      monitors: () => db.monitor.listAll(),
      incidents: () => db.incident.listRecent(12),
      openIncidentCount: () => db.incident.countOpen(),
      heartbeatCountLastHour: () =>
        db.monitor.countHeartbeatsSince(hoursAgoIso(1)),
      heartbeatCountLastDay: () =>
        db.monitor.countHeartbeatsSince(daysAgoIso(1)),
      heartbeats: () =>
        db.monitor.listRecentHeartbeats(RECENT_DASHBOARD_HEARTBEAT_LIMIT),
      statusPages: () => db.statusPage.list(),
    });
    const counts = monitors.reduce(
      (current, monitor) => ({
        ...current,
        [monitor.lastStatus]: current[monitor.lastStatus] + 1,
      }),
      { up: 0, down: 0, unknown: 0 },
    );

    return ctx.json({
      monitors,
      incidents,
      openIncidentCount,
      heartbeatCounts: {
        lastHour: heartbeatCountLastHour,
        lastDay: heartbeatCountLastDay,
      },
      heartbeats,
      statusPages,
      counts,
      overallStatus: computeAggregateStatus(
        monitors.map((monitor) => monitor.lastStatus),
      ),
    });
  })
  .get(
    "/incidents",
    zValidator("query", incidentFiltersSchema),
    async (ctx) => {
      const query = ctx.req.valid("query");
      const db = createDatabase(ctx.env.DB);

      const incidents = await db.incident.list({
        status: query.status,
        monitorId: query.monitor || undefined,
        query: query.q || undefined,
      });

      return ctx.json(incidents);
    },
  );
