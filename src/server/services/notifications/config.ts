import type {
  DiscordNotificationConfig,
  NotificationDestinationConfig,
  NotificationHeader,
  NotificationProvider,
  TelegramNotificationConfig,
  WebhookNotificationConfig,
} from "@/types";

export function parseNotificationConfig(
  provider: NotificationProvider,
  configJson: string,
) {
  const parsed = JSON.parse(configJson) as Record<string, unknown>;
  if (provider === "discord") {
    return {
      webhookUrl: String(parsed.webhookUrl ?? ""),
    } satisfies DiscordNotificationConfig;
  }
  if (provider === "webhook") {
    return {
      url: String(parsed.url ?? ""),
      headers: parseNotificationHeaders(parsed.headers),
    } satisfies WebhookNotificationConfig;
  }

  return {
    botToken: String(parsed.botToken ?? ""),
    chatId: String(parsed.chatId ?? ""),
    messageThreadId:
      typeof parsed.messageThreadId === "string" &&
      parsed.messageThreadId.trim() !== ""
        ? parsed.messageThreadId
        : null,
  } satisfies TelegramNotificationConfig;
}

export function serializeNotificationConfig(
  provider: NotificationProvider,
  config: NotificationDestinationConfig,
) {
  if (provider === "discord") {
    return JSON.stringify({
      webhookUrl: (config as DiscordNotificationConfig).webhookUrl,
    });
  }
  if (provider === "webhook") {
    const webhookConfig = config as WebhookNotificationConfig;
    return JSON.stringify({
      url: webhookConfig.url,
      headers: parseNotificationHeaders(webhookConfig.headers),
    });
  }

  const telegramConfig = config as TelegramNotificationConfig;
  return JSON.stringify({
    botToken: telegramConfig.botToken,
    chatId: telegramConfig.chatId,
    messageThreadId: telegramConfig.messageThreadId ?? undefined,
  });
}

export function parseNotificationHeaders(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((header) => {
      const item = header as Record<string, unknown>;
      return {
        key: String(item.key ?? "").trim(),
        value: String(item.value ?? "").trim(),
      } satisfies NotificationHeader;
    })
    .filter((header) => header.key.length > 0);
}
