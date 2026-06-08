import type { Context } from "hono";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import { createAppDb } from "@/api/db";

const statusPageInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  published: z.boolean(),
  showHistory: z.boolean(),
  monitorIds: z.array(z.string()).default([]),
});

export const statusPagesApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    const pages = await db.dashboard.listStatusPages();
    const monitors = await db.dashboard.listMonitors();
    const links = await db.dashboard.listStatusPageLinks();

    return ctx.json({
      pages,
      monitors,
      links,
    });
  })
  .post("/", zValidator("json", statusPageInputSchema), async (ctx) => {
    const saved = await saveStatusPage(ctx, ctx.req.valid("json"));

    return ctx.json(saved, 201);
  })
  .get("/:id", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    const page = await db.statusPage.getById(ctx.req.param("id"));
    if (!page) {
      throw new HTTPException(404, { message: "Status page not found" });
    }
    const monitors = await db.dashboard.listMonitors();

    return ctx.json({ ...page, monitors });
  })
  .put("/:id", zValidator("json", statusPageInputSchema), async (ctx) => {
    const saved = await saveStatusPage(
      ctx,
      ctx.req.valid("json"),
      ctx.req.param("id"),
    );

    return ctx.json(saved);
  })
  .delete("/:id", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    await db.statusPage.delete(ctx.req.param("id"));

    return ctx.json({ ok: true });
  });

export const publicStatusApi = new Hono<AppEnv>().get("/:slug", async (ctx) => {
  const db = createAppDb(ctx.env.DB);
  const statusPage = await db.statusPage.getPublic(ctx.req.param("slug"));
  if (!statusPage) {
    throw new HTTPException(404, { message: "Status page not found" });
  }
  return ctx.json(statusPage);
});

async function saveStatusPage(
  ctx: Context<AppEnv>,
  body: z.infer<typeof statusPageInputSchema>,
  id?: string,
) {
  const pageId = id ?? body.id;
  const db = createAppDb(ctx.env.DB);
  await db.statusPage.createOrUpdate({
    id: pageId,
    slug: body.slug,
    title: body.title,
    description: body.description ?? null,
    published: body.published ? 1 : 0,
    showHistory: body.showHistory ? 1 : 0,
    monitorIds: body.monitorIds,
  });
  return pageId
    ? db.statusPage.getById(pageId)
    : getStatusPageBySlugForSave(db, body.slug);
}

async function getStatusPageBySlugForSave(
  db: ReturnType<typeof createAppDb>,
  slug: string,
) {
  const pages = await db.dashboard.listStatusPages();
  const page = pages.find((item) => item.slug === slug);
  return page ? db.statusPage.getById(page.id) : null;
}
