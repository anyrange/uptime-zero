import { format } from "date-fns";

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

  return format(date, "PP pp");
}

export function formatRelativeDateTime(
  value: string | null | undefined,
  now = Date.now(),
) {
  if (!value) {
    return m.common_never();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return m.common_unknown();
  }

  const deltaMs = now - date.getTime();
  const absSeconds = Math.max(0, Math.floor(Math.abs(deltaMs) / 1000));
  const suffix = deltaMs >= 0 ? "ago" : "from_now";

  if (absSeconds < 60) {
    return suffix === "ago"
      ? m.common_seconds_ago({ count: absSeconds })
      : m.common_seconds_from_now({ count: absSeconds });
  }

  const minutes = Math.floor(absSeconds / 60);
  if (minutes < 60) {
    return suffix === "ago"
      ? m.common_minutes_ago({ count: minutes })
      : m.common_minutes_from_now({ count: minutes });
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return suffix === "ago"
      ? m.common_hours_ago({ count: hours })
      : m.common_hours_from_now({ count: hours });
  }

  const days = Math.floor(hours / 24);
  return suffix === "ago"
    ? m.common_days_ago({ count: days })
    : m.common_days_from_now({ count: days });
}

export function formatDurationMs(value: number | null | undefined) {
  return value == null ? m.common_not_available() : m.common_ms({ value });
}

export function formatUptimePercent(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
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
