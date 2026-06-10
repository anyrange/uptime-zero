import { all } from "better-all";

import type {
  DiscordNotificationConfig,
  MonitorRecord,
  NotificationDestinationRecord,
  NotificationHeader,
  TelegramNotificationConfig,
  WebhookNotificationConfig,
} from "@/types";

import { parseNotificationHeaders } from "@/server/services/notifications/config";

export type MonitorTransitionNotification = {
  kind: "transition";
  monitor: MonitorRecord;
  status: "up" | "down";
  checkedAt: string;
  error: string | null;
};

export type TestNotification = {
  kind: "test";
  sentAt: string;
  destination: Pick<NotificationDestinationRecord, "id" | "name" | "provider">;
};

export type NotificationEvent =
  | MonitorTransitionNotification
  | TestNotification;

export class NotificationDeliveryError extends Error {
  constructor(
    readonly destination: Pick<
      NotificationDestinationRecord,
      "name" | "provider"
    >,
    readonly status: number,
  ) {
    super(
      `${destination.provider} notification failed for ${destination.name}: HTTP ${status}`,
    );
    this.name = "NotificationDeliveryError";
  }
}

export function buildTransitionNotificationPayload(
  monitor: MonitorRecord,
  status: "up" | "down",
  checkedAt: string,
  error: string | null,
) {
  return {
    kind: status === "down" ? "monitor.down" : "monitor.recovered",
    monitor: {
      id: monitor.id,
      name: monitor.name,
      kind: monitor.kind,
      target: monitor.target,
    },
    status,
    checkedAt,
    error,
  };
}

export function buildTransitionNotificationText(
  monitor: MonitorRecord,
  status: "up" | "down",
  _checkedAt: string,
  error: string | null,
) {
  const stateLabel = status === "down" ? "Down" : "Up";
  const stateIcon = status === "down" ? "🔴" : "✅";
  const summary =
    status === "down" ? (error ?? "monitor check failed") : "recovered";
  const lines = [
    monitor.name,
    `[${monitor.kind}] [${stateIcon} ${stateLabel}] ${summary}`,
  ];
  if (monitor.target) {
    lines.push(monitor.target);
  }
  return lines.join("\n");
}

export function buildTestNotificationPayload(
  destination: Pick<NotificationDestinationRecord, "id" | "name" | "provider">,
  sentAt: string,
) {
  return {
    kind: "notification.test",
    destination,
    sentAt,
    message: `Test notification from Uptime Zero for ${destination.name}.`,
  };
}

export function buildTestNotificationText(
  destination: Pick<NotificationDestinationRecord, "id" | "name" | "provider">,
  sentAt: string,
) {
  return [
    `Test notification: ${destination.name}`,
    `Provider: ${destination.provider}`,
    `Sent at: ${sentAt}`,
  ].join("\n");
}

export async function deliverNotificationDestination(
  destination: NotificationDestinationRecord,
  event: NotificationEvent,
  fetchImpl: typeof fetch = fetch,
) {
  if (destination.provider === "discord") {
    const discordConfig = destination.config as DiscordNotificationConfig;
    const response = await fetchImpl(discordConfig.webhookUrl, {
      method: "POST",
      headers: notificationRequestHeaders(),
      body: JSON.stringify(buildDiscordPayload(destination, event)),
    });
    assertNotificationResponse(response, destination);
    return;
  }

  if (destination.provider === "webhook") {
    const webhookConfig = destination.config as WebhookNotificationConfig;
    const body =
      event.kind === "transition"
        ? buildTransitionNotificationPayload(
            event.monitor,
            event.status,
            event.checkedAt,
            event.error,
          )
        : buildTestNotificationPayload(event.destination, event.sentAt);

    const response = await fetchImpl(webhookConfig.url, {
      method: "POST",
      headers: {
        ...notificationRequestHeaders(),
        ...headersToObject(webhookConfig.headers),
      },
      body: JSON.stringify(body),
    });
    assertNotificationResponse(response, destination);
    return;
  }

  const telegramConfig = destination.config as TelegramNotificationConfig;
  const payload: Record<string, string> = {
    chat_id: telegramConfig.chatId,
    text:
      event.kind === "transition"
        ? buildTransitionNotificationText(
            event.monitor,
            event.status,
            event.checkedAt,
            event.error,
          )
        : buildTestNotificationText(event.destination, event.sentAt),
  };
  if (telegramConfig.messageThreadId) {
    payload.message_thread_id = telegramConfig.messageThreadId;
  }

  const response = await fetchImpl(
    `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`,
    {
      method: "POST",
      headers: notificationRequestHeaders(),
      body: JSON.stringify(payload),
    },
  );
  assertNotificationResponse(response, destination);
}

export async function dispatchNotificationEvent(
  destinations: NotificationDestinationRecord[],
  event: NotificationEvent,
  fetchImpl: typeof fetch = fetch,
  options: { throwOnFailure?: boolean } = {},
) {
  if (destinations.length === 0) {
    return;
  }

  await all(
    Object.fromEntries(
      destinations.map((destination) => [
        destination.id,
        async () => {
          try {
            await deliverNotificationDestination(destination, event, fetchImpl);
          } catch (error) {
            if (options.throwOnFailure) {
              throw error;
            }
            // Ignore delivery failures during phase 1 polling.
          }
        },
      ]),
    ),
  );
}

function notificationRequestHeaders() {
  return {
    "content-type": "application/json",
    "user-agent": "uptime-zero/0.1.0",
  };
}

function assertNotificationResponse(
  response: Response,
  destination: Pick<NotificationDestinationRecord, "name" | "provider">,
) {
  if (response.ok) {
    return;
  }

  throw new NotificationDeliveryError(destination, response.status);
}

function headersToObject(headers?: NotificationHeader[]) {
  return Object.fromEntries(
    parseNotificationHeaders(headers).map((header) => [
      header.key,
      header.value,
    ]),
  );
}

function buildDiscordPayload(
  destination: NotificationDestinationRecord,
  event: NotificationEvent,
) {
  if (event.kind === "test") {
    return {
      embeds: [
        {
          title: `Test notification: ${destination.name}`,
          description: `Provider ${destination.provider} is reachable.`,
          color: 5_816_780,
          fields: [
            { name: "Destination", value: destination.name, inline: true },
            { name: "Sent at", value: event.sentAt, inline: true },
          ],
          timestamp: event.sentAt,
        },
      ],
    };
  }

  const isDown = event.status === "down";
  return {
    embeds: [
      {
        title: isDown
          ? `Monitor down: ${event.monitor.name}`
          : `Monitor recovered: ${event.monitor.name}`,
        color: isDown ? 15_584_997 : 5_766_719,
        fields: [
          { name: "Status", value: event.status.toUpperCase(), inline: true },
          {
            name: "Type",
            value: event.monitor.kind.toUpperCase(),
            inline: true,
          },
          {
            name: "Target",
            value: event.monitor.target || "(push monitor)",
            inline: false,
          },
          { name: "Checked at", value: event.checkedAt, inline: false },
          ...(isDown && event.error
            ? [{ name: "Error", value: event.error, inline: false }]
            : []),
        ],
        timestamp: event.checkedAt,
      },
    ],
  };
}
