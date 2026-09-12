import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { requireApiPermission } from "@/server/middleware/permissions";
import { getPublicStatus } from "@/server/services/public-status";

const statusPageInputSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  published: z.boolean(),
  showHistory: z.boolean(),
  showTarget: z.boolean().default(false),
  monitorIds: z.array(z.string()).max(90).default([]),
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

      const savedId = await db.statusPage.createOrUpdate({
        slug: body.slug,
        title: body.title,
        description: body.description ?? null,
        published: body.published ? 1 : 0,
        showHistory: body.showHistory ? 1 : 0,
        showTarget: body.showTarget ? 1 : 0,
        monitorIds: body.monitorIds,
      });

      const saved = await db.statusPage.getById(savedId);

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

      if (!(await db.statusPage.getById(pageId)))
        throw new HTTPException(404, { message: "Status page not found" });
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

  const data = await getPublicStatus(db, ctx.req.param("slug"));

  if (!data) throw new HTTPException(404, { message: "Status page not found" });
  ctx.header("Cache-Control", "no-store");

  return ctx.json(data);
});
