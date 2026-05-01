import { zValidator } from "@hono/zod-validator";
import { all } from "better-all";
import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "@/ctx";
import type { IncidentListFilters } from "@/types";

import { createAppDb } from "@/api/db";
import { getMonitorActorStub } from "@/api/durable/monitor-actor-client";

const incidentFiltersSchema = z.object({
  status: z.enum(["open", "closed", "all"]).default("all"),
  monitor: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

export const dashboardApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    return ctx.json(await db.dashboard.get());
  })
  .get("/summary", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    return ctx.json(await db.dashboard.getSummarySnapshot());
  })
  .get(
    "/incidents",
    zValidator("query", incidentFiltersSchema),
    async (ctx) => {
      const filters = readIncidentFilters(ctx.req.valid("query"));
      const db = createAppDb(ctx.env.DB);
      return ctx.json(await db.incident.list(filters));
    },
  )
  .post("/run-checks", async (ctx) => {
    ctx.get("log").set({
      action: "run_checks",
      trigger: "dashboard",
    });
    const db = createAppDb(ctx.env.DB);
    const monitorIds = await db.monitor.listActiveIds();
    await all(
      Object.fromEntries(
        monitorIds.map((monitorId) => [
          monitorId,
          () =>
            getMonitorActorStub(ctx.env, monitorId).runNow(
              "dashboard-manual",
              monitorId,
            ),
        ]),
      ),
    );
    return ctx.json(await db.dashboard.get());
  })
  .get("/events", async (ctx) => {
    const encoder = new TextEncoder();
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let lastSnapshotKey = "";

    const stream = new ReadableStream({
      start(controller) {
        const sendSnapshot = async () => {
          if (closed) {
            return;
          }
          const db = createAppDb(ctx.env.DB);
          const snapshot = await db.dashboard.getSummarySnapshot();
          const payload = JSON.stringify(snapshot);
          const snapshotKey = JSON.stringify({
            ...snapshot,
            generatedAt: undefined,
          });
          if (snapshotKey !== lastSnapshotKey) {
            controller.enqueue(
              encoder.encode(`event: snapshot\ndata: ${payload}\n\n`),
            );
            lastSnapshotKey = snapshotKey;
          }
        };
        controller.enqueue(
          encoder.encode(`event: ping\ndata: {"ok":true}\n\n`),
        );
        void sendSnapshot();
        intervalId = setInterval(() => {
          void sendSnapshot();
        }, 5000);
      },
      cancel() {
        closed = true;
        if (intervalId) {
          clearInterval(intervalId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  });

function readIncidentFilters(
  query: z.infer<typeof incidentFiltersSchema>,
): IncidentListFilters {
  return {
    status: query.status,
    monitorId: query.monitor || undefined,
    query: query.q || undefined,
  };
}
