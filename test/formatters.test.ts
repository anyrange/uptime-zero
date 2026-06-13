import { describe, expect, it, vi } from "vitest";

import type { HeartbeatRecord, NotificationDestinationRecord } from "@/types";

import {
  formatDateTime,
  formatDurationMs,
  formatIncidentDuration,
  formatRelativeDateTime,
  groupHeartbeats,
  notificationSummary,
} from "@/lib/formatters";
import { m } from "@/paraglide/messages.js";

describe("formatting helpers", () => {
  it("returns translated placeholders for missing and invalid timestamps", () => {
    expect(formatDateTime(null)).toBe(m.common_never());
    expect(formatDateTime("not-a-date")).toBe(m.common_unknown());

    expect(formatRelativeDateTime(null)).toBe(m.common_never());
    expect(formatRelativeDateTime("not-a-date")).toBe(m.common_unknown());
  });

  it("formats concise relative times across units", () => {
    expect(
      formatRelativeDateTime(
        "2026-06-13T00:00:00.000Z",
        Date.parse("2026-06-13T00:00:30.000Z"),
      ),
    ).toBe(m.common_seconds_ago({ count: 30 }));

    expect(
      formatRelativeDateTime(
        "2026-06-13T00:00:00.000Z",
        Date.parse("2026-06-13T00:01:00.000Z"),
      ),
    ).toBe(m.common_minutes_ago({ count: 1 }));

    expect(
      formatRelativeDateTime(
        "2026-06-13T00:01:00.000Z",
        Date.parse("2026-06-13T00:00:00.000Z"),
      ),
    ).toBe(m.common_minutes_from_now({ count: 1 }));
  });

  it("formats durations, availability, and incident summaries consistently", () => {
    expect(formatDurationMs(null)).toBe(m.common_not_available());
    expect(formatDurationMs(1_234)).toBe(m.common_ms({ value: 1_234 }));

    expect(
      formatIncidentDuration({
        status: "closed",
        openedAt: "2026-06-13T00:00:00.000Z",
        closedAt: "2026-06-13T00:01:31.000Z",
        durationMs: 90_000,
      }),
    ).toBe(m.common_minutes_short({ value: 1 }));
  });

  it("formats open incidents using deterministic time windows", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-06-13T00:03:00.000Z"));

      expect(
        formatIncidentDuration({
          status: "open",
          openedAt: "2026-06-13T00:00:00.000Z",
          closedAt: null,
        }),
      ).toBe(m.common_minutes_short({ value: 3 }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("summarizes notification destinations", () => {
    const discord: NotificationDestinationRecord = {
      id: "1",
      name: "Discord",
      provider: "discord",
      configJson: "{}",
      config: { webhookUrl: "https://discord.com/webhook" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const webhook: NotificationDestinationRecord = {
      id: "2",
      name: "Webhook",
      provider: "webhook",
      configJson: "{}",
      config: {
        url: "https://example.com/hook",
        headers: [{ key: "X-Api-Key", value: "token" }],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const webhookNoHeaders: NotificationDestinationRecord = {
      id: "3",
      name: "Webhook",
      provider: "webhook",
      configJson: "{}",
      config: { url: "https://example.com/empty", headers: [] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const telegramWithThread: NotificationDestinationRecord = {
      id: "4",
      name: "Telegram",
      provider: "telegram",
      configJson: "{}",
      config: {
        botToken: "bot",
        chatId: "123",
        messageThreadId: "9",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const telegramFlat: NotificationDestinationRecord = {
      id: "5",
      name: "Telegram",
      provider: "telegram",
      configJson: "{}",
      config: { botToken: "bot", chatId: "123", messageThreadId: null },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(notificationSummary(discord)).toBe("https://discord.com/webhook");
    expect(notificationSummary(webhook)).toBe(
      `https://example.com/hook (${m.common_count_headers({ count: 1 })})`,
    );
    expect(notificationSummary(webhookNoHeaders)).toBe(
      "https://example.com/empty",
    );
    expect(notificationSummary(telegramWithThread)).toBe(
      m.notification_chat_thread({ chatId: "123", threadId: "9" }),
    );
    expect(notificationSummary(telegramFlat)).toBe(
      m.notification_chat({ chatId: "123" }),
    );
  });

  it("groups heartbeat records by monitor id", () => {
    const heartbeats: HeartbeatRecord[] = [
      {
        id: "1",
        monitorId: "m1",
        status: "up",
        statusCode: 200,
        durationMs: 100,
        error: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        source: "poll",
      },
      {
        id: "2",
        monitorId: "m2",
        status: "down",
        statusCode: 500,
        durationMs: 200,
        error: "timeout",
        createdAt: "2026-01-01T00:00:01.000Z",
        source: "system",
      },
      {
        id: "3",
        monitorId: "m1",
        status: "up",
        statusCode: 200,
        durationMs: 120,
        error: null,
        createdAt: "2026-01-01T00:00:02.000Z",
        source: "poll",
      },
    ];

    const grouped = groupHeartbeats(heartbeats);

    expect(grouped.get("m1")).toHaveLength(2);
    expect(grouped.get("m2")).toHaveLength(1);
  });
});
