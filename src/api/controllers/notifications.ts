import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";
import type {
  NotificationDestinationConfig,
  NotificationHeader,
  NotificationProvider,
} from "@/types";

import { createAppDb } from "@/api/db";
import { NotificationDestinationValidationError } from "@/api/db/models/notification";

const notificationHeaderSchema = z.object({
  key: z.string().trim().min(1, "Header key is required."),
  value: z.string().trim(),
});

const notificationInputSchema = z.discriminatedUnion("provider", [
  z.object({
    name: z.string().trim().min(1),
    provider: z.literal("discord"),
    webhookUrl: z.url(),
    monitorIds: z.array(z.string()).default([]),
  }),
  z.object({
    name: z.string().trim().min(1),
    provider: z.literal("webhook"),
    url: z.url(),
    headers: z.array(notificationHeaderSchema).default([]),
    monitorIds: z.array(z.string()).default([]),
  }),
  z.object({
    name: z.string().trim().min(1),
    provider: z.literal("telegram"),
    botToken: z.string().trim().min(1),
    chatId: z.string().trim().min(1),
    messageThreadId: z.string().trim().optional().nullable(),
    monitorIds: z.array(z.string()).default([]),
  }),
]);

export const notificationsApi = new Hono<AppEnv>()
  .get("/", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    return ctx.json({
      destinations: await db.notification.list(),
      monitors: await db.notification.listAssignableMonitors(),
    });
  })
  .get("/:id", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    const detail = await db.notification.getDetail(ctx.req.param("id"));
    if (!detail) {
      throw new HTTPException(404, { message: "Notification not found" });
    }
    return ctx.json(detail);
  })
  .post("/", zValidator("json", notificationInputSchema), async (ctx) => {
    const input = parseNotificationInput(ctx.req.valid("json"));
    try {
      const db = createAppDb(ctx.env.DB);
      const destination = await db.notification.create(
        input.name,
        input.provider,
        input.config,
        input.monitorIds,
      );
      return ctx.json(destination, 201);
    } catch (error) {
      throw toNotificationException(error);
    }
  })
  .put("/:id", zValidator("json", notificationInputSchema), async (ctx) => {
    const input = parseNotificationInput(ctx.req.valid("json"));
    try {
      const db = createAppDb(ctx.env.DB);
      const destination = await db.notification.update(
        ctx.req.param("id"),
        input,
      );
      if (!destination) {
        throw new HTTPException(404, { message: "Notification not found" });
      }
      return ctx.json(destination);
    } catch (error) {
      throw toNotificationException(error);
    }
  })
  .delete("/:id", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    await db.notification.delete(ctx.req.param("id"));
    return ctx.json({ ok: true });
  })
  .post("/:id/test", async (ctx) => {
    const db = createAppDb(ctx.env.DB);
    await db.notification.test(ctx.req.param("id"));
    return ctx.json({ ok: true });
  });

function parseNotificationInput(
  body: z.infer<typeof notificationInputSchema>,
): {
  name: string;
  provider: NotificationProvider;
  config: NotificationDestinationConfig;
  monitorIds: string[];
} {
  if (body.provider === "discord") {
    return {
      name: body.name,
      provider: body.provider,
      config: {
        webhookUrl: body.webhookUrl,
      },
      monitorIds: dedupeIds(body.monitorIds),
    };
  }

  if (body.provider === "telegram") {
    return {
      name: body.name,
      provider: body.provider,
      config: {
        botToken: body.botToken,
        chatId: body.chatId,
        messageThreadId: body.messageThreadId || null,
      },
      monitorIds: dedupeIds(body.monitorIds),
    };
  }

  return {
    name: body.name,
    provider: body.provider,
    config: {
      url: body.url,
      headers: normalizeHeaders(body.headers),
    },
    monitorIds: dedupeIds(body.monitorIds),
  };
}

function normalizeHeaders(headers: NotificationHeader[]) {
  return headers.filter((header) => header.key.trim().length > 0);
}

function dedupeIds(ids: string[]) {
  return [...new Set(ids)];
}

function toNotificationException(error: unknown) {
  if (error instanceof HTTPException) {
    return error;
  }
  if (error instanceof NotificationDestinationValidationError) {
    return new HTTPException(400, { message: error.message });
  }
  return new HTTPException(500, { message: "Failed to save notification" });
}
