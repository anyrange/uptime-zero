import { z } from "zod";

import type {
  DiscordNotificationConfig,
  NotificationDestinationConfig,
  NotificationProvider,
  TelegramNotificationConfig,
  WebhookNotificationConfig,
} from "@/types";

const discordConfigSchema = z.object({
  webhookUrl: z.string().catch("").default(""),
});
const notificationHeaderSchema = z.object({
  key: z
    .string()
    .transform((value) => value.trim())
    .catch(""),
  value: z
    .string()
    .transform((value) => value.trim())
    .catch(""),
});
const notificationHeadersSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : []),
  z
    .array(notificationHeaderSchema)
    .transform((headers) => headers.filter((header) => header.key.length > 0)),
);
const webhookConfigSchema = z.object({
  url: z.string().catch("").default(""),
  headers: notificationHeadersSchema,
});
const telegramConfigSchema = z.object({
  botToken: z.string().catch("").default(""),
  chatId: z.string().catch("").default(""),
  messageThreadId: z.string().trim().min(1).nullable().catch(null),
});

export function parseNotificationConfig(
  provider: "discord",
  configJson: string,
): DiscordNotificationConfig;
export function parseNotificationConfig(
  provider: "webhook",
  configJson: string,
): WebhookNotificationConfig;
export function parseNotificationConfig(
  provider: "telegram",
  configJson: string,
): TelegramNotificationConfig;
export function parseNotificationConfig(
  provider: NotificationProvider,
  configJson: string,
): NotificationDestinationConfig;
export function parseNotificationConfig(
  provider: NotificationProvider,
  configJson: string,
): NotificationDestinationConfig {
  const parsed = JSON.parse(configJson);
  if (provider === "discord") {
    return discordConfigSchema.parse(
      parsed,
    ) satisfies DiscordNotificationConfig;
  }
  if (provider === "webhook") {
    return webhookConfigSchema.parse(
      parsed,
    ) satisfies WebhookNotificationConfig;
  }

  return telegramConfigSchema.parse(
    parsed,
  ) satisfies TelegramNotificationConfig;
}

export function serializeNotificationConfig(
  provider: NotificationProvider,
  config: NotificationDestinationConfig,
) {
  if (provider === "discord") {
    const discordConfig = discordConfigSchema.parse(config);
    return JSON.stringify({
      webhookUrl: discordConfig.webhookUrl,
    });
  }
  if (provider === "webhook") {
    const webhookConfig = webhookConfigSchema.parse(config);
    return JSON.stringify({
      url: webhookConfig.url,
      headers: parseNotificationHeaders(webhookConfig.headers),
    });
  }

  const telegramConfig = telegramConfigSchema.parse(config);
  return JSON.stringify({
    botToken: telegramConfig.botToken,
    chatId: telegramConfig.chatId,
    messageThreadId: telegramConfig.messageThreadId ?? undefined,
  });
}

export function parseNotificationHeaders(
  value: z.input<typeof notificationHeadersSchema>,
) {
  return notificationHeadersSchema
    .parse(value)
    .filter((header) => header.key.length > 0);
}
