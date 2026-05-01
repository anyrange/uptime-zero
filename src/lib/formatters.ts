import { format, formatDistanceToNowStrict } from "date-fns";

import type { HeartbeatRecord, NotificationDestinationRecord } from "@/types";

import { m } from "@/paraglide/messages.js";

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return m.common_never();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return m.common_unknown();
  }

  return format(date, "PP p");
}

export function formatRelativeDateTime(value: string | null | undefined) {
  if (!value) {
    return m.common_never();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return m.common_unknown();
  }

  const deltaMs = Date.now() - date.getTime();
  if (deltaMs < 60_000) {
    return m.common_just_now();
  }

  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function formatDurationMs(value: number | null | undefined) {
  return value == null ? m.common_not_available() : m.common_ms({ value });
}

export function formatIncidentDuration(incident: {
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  durationMs?: number | null;
}) {
  if (incident.status === "closed" && incident.durationMs != null) {
    return formatDurationSpan(incident.durationMs);
  }

  const openedAt = new Date(incident.openedAt);
  if (Number.isNaN(openedAt.getTime())) {
    return m.common_unknown();
  }

  const closedAt = incident.closedAt ? new Date(incident.closedAt) : new Date();
  if (Number.isNaN(closedAt.getTime())) {
    return m.common_unknown();
  }

  return formatDurationSpan(closedAt.getTime() - openedAt.getTime());
}

function formatDurationSpan(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  if (totalSeconds < 60) {
    return m.common_seconds_short({ value: totalSeconds });
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return m.common_minutes_short({ value: totalMinutes });
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0
      ? m.common_hours_minutes_short({ hours, minutes })
      : m.common_hours_short({ value: hours });
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0
    ? m.common_days_hours_short({ days, hours: remainingHours })
    : m.common_days_short({ value: days });
}

export function notificationSummary(
  destination: NotificationDestinationRecord,
) {
  if (destination.provider === "discord") {
    return (destination.config as { webhookUrl: string }).webhookUrl;
  }
  if (destination.provider === "telegram") {
    const config = destination.config as {
      chatId: string;
      messageThreadId?: string | null;
    };
    return config.messageThreadId
      ? m.notification_chat_thread({
          chatId: config.chatId,
          threadId: config.messageThreadId,
        })
      : m.notification_chat({ chatId: config.chatId });
  }
  const config = destination.config as {
    url: string;
    headers?: { key: string; value: string }[];
  };
  return config.headers && config.headers.length > 0
    ? `${config.url} (${m.common_count_headers({ count: config.headers.length })})`
    : config.url;
}

export function groupHeartbeats(heartbeats: HeartbeatRecord[]) {
  const map = new Map<string, HeartbeatRecord[]>();
  for (const heartbeat of heartbeats) {
    const monitorHeartbeats = map.get(heartbeat.monitorId);
    if (monitorHeartbeats) {
      monitorHeartbeats.push(heartbeat);
    } else {
      map.set(heartbeat.monitorId, [heartbeat]);
    }
  }
  return map;
}
