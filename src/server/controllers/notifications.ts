import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppEnv } from "@/ctx";

import { createDatabase } from "@/server/db";
import { NotificationDestinationValidationError } from "@/server/db/models/notification";
import { NotificationService } from "@/server/services/notifications";

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
    const db = createDatabase(ctx.env.DB);

    return ctx.json({
      destinations: await db.notification.list(),
      monitors: await db.notification.listAssignableMonitors(),
    });
  })
  .get("/:id", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const detail = await db.notification.getDetail(ctx.req.param("id"));
    if (!detail) {
      throw new HTTPException(404, { message: "Notification not found" });
    }

    return ctx.json(detail);
  })
  .post("/", zValidator("json", notificationInputSchema), async (ctx) => {
    const input = ctx.req.valid("json");
    const monitorIds = [...new Set(input.monitorIds)];
    const config =
      input.provider === "discord"
        ? { webhookUrl: input.webhookUrl }
        : input.provider === "telegram"
          ? {
              botToken: input.botToken,
              chatId: input.chatId,
              messageThreadId: input.messageThreadId || null,
            }
          : {
              url: input.url,
              headers: input.headers.filter(
                (header) => header.key.trim().length > 0,
              ),
            };

    try {
      const db = createDatabase(ctx.env.DB);
      const destination = await db.notification.create(
        input.name,
        input.provider,
        config,
        monitorIds,
      );
      return ctx.json(destination, 201);
    } catch (error) {
      if (error instanceof NotificationDestinationValidationError) {
        throw new HTTPException(400, { message: error.message });
      }
      throw new HTTPException(500, {
        message: "Failed to create notification",
      });
    }
  })
  .put("/:id", zValidator("json", notificationInputSchema), async (ctx) => {
    const input = ctx.req.valid("json");
    const monitorIds = [...new Set(input.monitorIds)];
    const config =
      input.provider === "discord"
        ? { webhookUrl: input.webhookUrl }
        : input.provider === "telegram"
          ? {
              botToken: input.botToken,
              chatId: input.chatId,
              messageThreadId: input.messageThreadId || null,
            }
          : {
              url: input.url,
              headers: input.headers.filter(
                (header) => header.key.trim().length > 0,
              ),
            };

    try {
      const db = createDatabase(ctx.env.DB);
      const destination = await db.notification.update(ctx.req.param("id"), {
        name: input.name,
        provider: input.provider,
        config,
        monitorIds,
      });
      if (!destination) {
        throw new HTTPException(404, { message: "Notification not found" });
      }
      return ctx.json(destination);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      if (error instanceof NotificationDestinationValidationError) {
        throw new HTTPException(400, { message: error.message });
      }
      throw new HTTPException(500, {
        message: "Failed to update notification",
      });
    }
  })
  .delete("/:id", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    await db.notification.delete(ctx.req.param("id"));

    return ctx.json({ ok: true });
  })
  .post("/:id/test", async (ctx) => {
    const db = createDatabase(ctx.env.DB);

    const notificationService = new NotificationService(db);

    const sent = await notificationService.sendTestNotification(
      ctx.req.param("id"),
    );

    if (!sent) {
      throw new HTTPException(404, { message: "Notification not found" });
    }

    return ctx.json({ ok: true });
  });
