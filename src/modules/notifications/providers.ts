import "@tanstack/react-start/server-only";
import type * as schema from "@schema";

import type {
  NotificationDestination,
  NotificationHeader,
} from "@/lib/schemas/notifications";

import { AppError } from "@/lib/errors";
import { m } from "@/paraglide/messages.js";

/**
 * Provider adapters: the payload each provider expects for an event, and one
 * delivery attempt over the global `fetch`.
 */

/** The monitor fields alerts describe. */
type Monitor = Pick<
  typeof schema.monitors.$inferSelect,
  "id" | "name" | "kind" | "target"
>;

export type MonitorTransitionNotification = {
  kind: "transition";
  monitor: Monitor;
  status: "up" | "down";
  checkedAt: string;
  error: string | null;
};

export type TestNotification = {
  kind: "test";
  sentAt: string;
  destination: Pick<NotificationDestination, "id" | "name" | "provider">;
};

export type NotificationEvent =
  | MonitorTransitionNotification
  | TestNotification;

export function buildTransitionNotificationPayload(
  monitor: Monitor,
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
  monitor: Monitor,
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
  destination: Pick<NotificationDestination, "id" | "name" | "provider">,
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
  destination: Pick<NotificationDestination, "id" | "name" | "provider">,
  sentAt: string,
) {
  return [
    `Test notification: ${destination.name}`,
    `Provider: ${destination.provider}`,
    `Sent at: ${sentAt}`,
  ].join("\n");
}

const NOTIFICATION_TIMEOUT_MS = 10_000;

/**
 * Posts one event to one destination. Transport failures and non-2xx
 * responses throw an `AppError` naming the destination; the outbox retries
 * them and test sends surface them to the user.
 */
export async function deliverNotification(
  destination: NotificationDestination,
  event: NotificationEvent,
) {
  const request = buildNotificationRequest(destination, event);

  const names = {
    provider: destination.provider,
    destination: destination.name,
  };

  let response: Response;

  try {
    response = await fetch(request.url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(NOTIFICATION_TIMEOUT_MS),
      headers: { ...notificationRequestHeaders(), ...request.headers },
      body: JSON.stringify(request.body),
    });
  } catch (cause) {
    throw new AppError(m.notification_delivery_failed(names), { cause });
  }

  await response.body?.cancel();

  if (!response.ok) {
    throw new AppError(
      m.notification_delivery_failed_status({
        ...names,
        status: response.status,
      }),
    );
  }
}

function buildNotificationRequest(
  destination: NotificationDestination,
  event: NotificationEvent,
) {
  switch (destination.provider) {
    case "discord":
      return {
        url: destination.config.webhookUrl,
        body: buildDiscordPayload(destination, event),
        headers: {},
      };
    case "webhook":
      return {
        url: destination.config.url,
        body:
          event.kind === "transition"
            ? buildTransitionNotificationPayload(
                event.monitor,
                event.status,
                event.checkedAt,
                event.error,
              )
            : buildTestNotificationPayload(event.destination, event.sentAt),
        headers: headersToObject(destination.config.headers),
      };
    case "telegram": {
      const { botToken, chatId, messageThreadId } = destination.config;

      const text =
        event.kind === "transition"
          ? buildTransitionNotificationText(
              event.monitor,
              event.status,
              event.checkedAt,
              event.error,
            )
          : buildTestNotificationText(event.destination, event.sentAt);

      return {
        url: `https://api.telegram.org/bot${botToken}/sendMessage`,
        body: messageThreadId
          ? { chat_id: chatId, text, message_thread_id: messageThreadId }
          : { chat_id: chatId, text },
        headers: {},
      };
    }
  }
}

function notificationRequestHeaders() {
  return {
    "content-type": "application/json",
    "user-agent": "uptime-zero/0.1.0",
  };
}

function headersToObject(headers: ReadonlyArray<NotificationHeader>) {
  return Object.fromEntries(
    headers.map((header) => [header.key, header.value]),
  );
}

function buildDiscordPayload(
  destination: NotificationDestination,
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
