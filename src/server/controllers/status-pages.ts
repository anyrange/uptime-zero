import { zValidator } from "@hono/zod-validator";
import { all } from "better-all";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { daysAgoIso } from "@/server/lib/dates";
import { computeAggregateStatus } from "@/server/lib/monitoring";
import { requireApiPermission } from "@/server/middleware/permissions";

const statusPageInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  published: z.boolean(),
  showHistory: z.boolean(),
  showTarget: z.boolean().default(false),
  monitorIds: z.array(z.string()).default([]),
});

export const statusPagesApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const pages = await db.statusPage.list();
    const monitors = await db.monitor.listAll();
    const links = await db.statusPage.listLinks();

    return ctx.json({
      pages,
      monitors,
      links,
    });
  })
  .post(
    "/",
    requireApiPermission("statusPage.create"),
    zValidator("json", statusPageInputSchema),
    async (ctx) => {
      const body = ctx.req.valid("json");

      const db = createDatabase(ctx.env.DB);

      await db.statusPage.createOrUpdate({
        id: body.id,
        slug: body.slug,
        title: body.title,
        description: body.description ?? null,
        published: body.published ? 1 : 0,
        showHistory: body.showHistory ? 1 : 0,
        showTarget: body.showTarget ? 1 : 0,
        monitorIds: body.monitorIds,
      });

      const pages = await db.statusPage.list();
      const page = pages.find((item) => item.slug === body.slug);
      const saved = page ? await db.statusPage.getById(page.id) : null;

      return ctx.json(saved, 201);
    },
  )
  .get("/:id", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const page = await db.statusPage.getById(ctx.req.param("id"));
    if (!page) {
      throw new HTTPException(404, { message: "Status page not found" });
    }

    const monitors = await db.monitor.listAll();

    return ctx.json({ ...page, monitors });
  })
  .put(
    "/:id",
    requireApiPermission("statusPage.update"),
    zValidator("json", statusPageInputSchema),
    async (ctx) => {
      const body = ctx.req.valid("json");
      const pageId = ctx.req.param("id");

      const db = createDatabase(ctx.env.DB);

      await db.statusPage.createOrUpdate({
        id: pageId,
        slug: body.slug,
        title: body.title,
        description: body.description ?? null,
        published: body.published ? 1 : 0,
        showHistory: body.showHistory ? 1 : 0,
        showTarget: body.showTarget ? 1 : 0,
        monitorIds: body.monitorIds,
      });
      const saved = await db.statusPage.getById(pageId);

      return ctx.json(saved);
    },
  )
  .delete("/:id", requireApiPermission("statusPage.delete"), async (ctx) => {
    const db = createDatabase(ctx.env.DB);
    await db.statusPage.delete(ctx.req.param("id"));

    return ctx.json({ ok: true });
  });

export const publicStatusApi = new Hono<AppEnv>().get("/:slug", async (ctx) => {
  const db = createDatabase(ctx.env.DB);

  const page = await db.statusPage.getPublishedBySlug(ctx.req.param("slug"));
  if (!page) {
    throw new HTTPException(404, { message: "Status page not found" });
  }

  const monitorIds = await db.statusPage.getMonitorIds(page.id);
  const settings = await db.settings.get();
  const heartbeatCutoff = daysAgoIso(settings.heartbeatRetentionDays);
  const { monitors, incidents, heartbeats } = monitorIds.length
    ? await all({
        monitors: () => db.monitor.listByIdsByName(monitorIds),
        incidents: () => db.incident.listForMonitors(monitorIds, 10),
        heartbeats: () =>
          db.monitor.listHeartbeatsForMonitorsSince(
            monitorIds,
            heartbeatCutoff,
          ),
      })
    : { monitors: [], incidents: [], heartbeats: [] };

  return ctx.json({
    page,
    monitors,
    incidents,
    heartbeats,
    historyDays: settings.heartbeatRetentionDays,
    status: computeAggregateStatus(
      monitors.map((monitor) => monitor.lastStatus),
    ),
  });
});
