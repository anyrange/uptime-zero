import { z } from "zod";

import type { MonitorKind } from "@/lib/schemas/monitors";

import { m } from "@/paraglide/messages.js";

export const NotificationProvider = z.enum(["discord", "webhook", "telegram"]);

export type NotificationProvider = z.infer<typeof NotificationProvider>;

const Url = z
  .string()
  .trim()
  .refine((value) => URL.canParse(value), {
    error: () => m.validation_url_invalid(),
  });

const RequiredText = z
  .string()
  .trim()
  .min(1, { error: () => m.notification_complete_required() });

export const NotificationHeader = z.object({
  key: z
    .string()
    .trim()
    .min(1, { error: () => m.validation_header_key_required() }),
  value: z.string().trim(),
});

export type NotificationHeader = z.infer<typeof NotificationHeader>;

const Headers = z.array(NotificationHeader).default([]);

export const DiscordConfig = z.object({ webhookUrl: Url });

export const WebhookConfig = z.object({ url: Url, headers: Headers });

export const TelegramConfig = z.object({
  botToken: RequiredText,
  chatId: RequiredText,
  /** Forum topic to post into; older configs omit it. */
  messageThreadId: z.string().nullable().default(null),
});

const destinationFields = {
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

/**
 * A configured alert target; `config` is discriminated by `provider`. The
 * repository parses each row's stored `configJson` with this schema.
 */
export const NotificationDestination = z.discriminatedUnion("provider", [
  z.object({
    ...destinationFields,
    provider: z.literal("discord"),
    config: DiscordConfig,
  }),
  z.object({
    ...destinationFields,
    provider: z.literal("webhook"),
    config: WebhookConfig,
  }),
  z.object({
    ...destinationFields,
    provider: z.literal("telegram"),
    config: TelegramConfig,
  }),
]);

export type NotificationDestination = z.infer<typeof NotificationDestination>;

export type AssignedMonitor = {
  readonly id: string;
  readonly name: string;
  readonly kind: MonitorKind;
};

export type NotificationDestinationSummary = NotificationDestination & {
  readonly assignedMonitors: ReadonlyArray<AssignedMonitor>;
};

export type NotificationDestinationDetail = NotificationDestination & {
  readonly monitorIds: ReadonlyArray<string>;
};

const inputFields = {
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.validation_name_required() }),
  monitorIds: z.array(z.string()).default([]),
};

/** What the notification form and its server functions accept. */
export const NotificationInput = z.discriminatedUnion("provider", [
  z.object({
    ...inputFields,
    provider: z.literal("discord"),
    webhookUrl: Url,
  }),
  z.object({
    ...inputFields,
    provider: z.literal("webhook"),
    url: Url,
    headers: Headers,
  }),
  z.object({
    ...inputFields,
    provider: z.literal("telegram"),
    botToken: RequiredText,
    chatId: RequiredText,
    messageThreadId: z.string().trim().nullable().default(null),
  }),
]);

export type NotificationInput = z.infer<typeof NotificationInput>;
