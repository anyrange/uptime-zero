import { describe, expect, it, vi } from "vitest";

import type { MonitorRecord, NotificationDestinationRecord } from "@/types";

import {
  dispatchNotificationEvent,
  deliverNotificationDestination,
} from "@/api/lib/notifications";

const monitor: MonitorRecord = {
  id: "monitor-api",
  name: "API Gateway",
  kind: "http",
  target: "https://status.example.com/health",
  intervalSec: 60,
  timeoutMs: 10000,
  retries: 0,
  assertions: [],
  sslExpiryWarnDays: 14,
  sslExpiryFailDays: 0,
  heartbeatMode: "interval",
  heartbeatCron: "0 * * * *",
  heartbeatGraceSec: 300,
  heartbeatTimezone: "UTC",
  pushToken: null,
  active: 1,
  lastStatus: "up",
  lastCheckedAt: null,
  lastDurationMs: null,
  lastError: null,
  lastCertValidTo: null,
  lastCertDaysRemaining: null,
  lastCertHostname: null,
  lastSslStatus: null,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const webhookDestination: NotificationDestinationRecord = {
  id: "dest-webhook",
  name: "Ops Webhook",
  provider: "webhook",
  configJson: JSON.stringify({
    url: "https://example.com/hook",
    headers: [{ key: "x-api-key", value: "secret" }],
  }),
  config: {
    url: "https://example.com/hook",
    headers: [{ key: "x-api-key", value: "secret" }],
  },
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const discordDestination: NotificationDestinationRecord = {
  id: "dest-discord",
  name: "Ops Discord",
  provider: "discord",
  configJson: JSON.stringify({
    webhookUrl: "https://discord.com/api/webhooks/1/abc",
  }),
  config: {
    webhookUrl: "https://discord.com/api/webhooks/1/abc",
  },
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const telegramDestination: NotificationDestinationRecord = {
  id: "dest-telegram",
  name: "Ops Telegram",
  provider: "telegram",
  configJson: JSON.stringify({
    botToken: "123456:abcdef",
    chatId: "-100100200300",
    messageThreadId: "42",
  }),
  config: {
    botToken: "123456:abcdef",
    chatId: "-100100200300",
    messageThreadId: "42",
  },
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("notification delivery", () => {
  it("posts the transition payload shape to webhook destinations", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await deliverNotificationDestination(
      webhookDestination,
      {
        kind: "transition",
        monitor,
        status: "down",
        checkedAt: "2026-05-04T10:00:00.000Z",
        error: "HTTP 500",
      },
      fetchMock as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-api-key": "secret",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init?.body))).toEqual({
      kind: "monitor.down",
      monitor: {
        id: "monitor-api",
        name: "API Gateway",
        kind: "http",
        target: "https://status.example.com/health",
      },
      status: "down",
      checkedAt: "2026-05-04T10:00:00.000Z",
      error: "HTTP 500",
    });
  });

  it("posts Discord-native embeds for transition events", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await deliverNotificationDestination(
      discordDestination,
      {
        kind: "transition",
        monitor,
        status: "down",
        checkedAt: "2026-05-04T10:00:00.000Z",
        error: "timeout",
      },
      fetchMock as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://discord.com/api/webhooks/1/abc");
    const body = JSON.parse(String(init?.body));
    expect(body.embeds[0].title).toContain("Monitor down");
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Status", value: "DOWN" }),
        expect.objectContaining({ name: "Error", value: "timeout" }),
      ]),
    );
  });

  it("sends Telegram messages with bot token, chat id, and thread id", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await deliverNotificationDestination(
      telegramDestination,
      {
        kind: "transition",
        monitor,
        status: "up",
        checkedAt: "2026-05-04T10:05:00.000Z",
        error: null,
      },
      fetchMock as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.telegram.org/bot123456:abcdef/sendMessage");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      chat_id: "-100100200300",
      message_thread_id: "42",
    });
    expect(JSON.parse(String(init?.body)).text).toBe(
      [
        "API Gateway",
        "[http] [✅ Up] recovered",
        "https://status.example.com/health",
      ].join("\n"),
    );
  });

  it("sends compact Telegram down alerts with the failure reason", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await deliverNotificationDestination(
      telegramDestination,
      {
        kind: "transition",
        monitor,
        status: "down",
        checkedAt: "2026-05-04T10:05:00.000Z",
        error: "Expected HTTP 200, got 502",
      },
      fetchMock as typeof fetch,
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init?.body)).text).toBe(
      [
        "API Gateway",
        "[http] [🔴 Down] Expected HTTP 200, got 502",
        "https://status.example.com/health",
      ].join("\n"),
    );
  });

  it("posts test payloads for all provider types", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await deliverNotificationDestination(
      discordDestination,
      {
        kind: "test",
        sentAt: "2026-05-04T10:10:00.000Z",
        destination: {
          id: discordDestination.id,
          name: discordDestination.name,
          provider: discordDestination.provider,
        },
      },
      fetchMock as typeof fetch,
    );
    await deliverNotificationDestination(
      webhookDestination,
      {
        kind: "test",
        sentAt: "2026-05-04T10:10:00.000Z",
        destination: {
          id: webhookDestination.id,
          name: webhookDestination.name,
          provider: webhookDestination.provider,
        },
      },
      fetchMock as typeof fetch,
    );
    await deliverNotificationDestination(
      telegramDestination,
      {
        kind: "test",
        sentAt: "2026-05-04T10:10:00.000Z",
        destination: {
          id: telegramDestination.id,
          name: telegramDestination.name,
          provider: telegramDestination.provider,
        },
      },
      fetchMock as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const discordCall = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const webhookCall = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    const telegramCall = fetchMock.mock.calls[2] as unknown as [
      string,
      RequestInit,
    ];
    const discordBody = JSON.parse(String(discordCall[1].body));
    const webhookBody = JSON.parse(String(webhookCall[1].body));
    const telegramBody = JSON.parse(String(telegramCall[1].body));
    expect(discordBody.embeds[0].title).toContain("Test notification");
    expect(webhookBody.kind).toBe("notification.test");
    expect(telegramBody.text).toContain("Test notification");
  });

  it("dispatches mixed bound destinations for one transition", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await dispatchNotificationEvent(
      [discordDestination, webhookDestination, telegramDestination],
      {
        kind: "transition",
        monitor,
        status: "down",
        checkedAt: "2026-05-04T10:00:00.000Z",
        error: "timeout",
      },
      fetchMock as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when a destination returns a non-success response", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));

    await expect(
      deliverNotificationDestination(
        webhookDestination,
        {
          kind: "transition",
          monitor,
          status: "down",
          checkedAt: "2026-05-04T10:00:00.000Z",
          error: "timeout",
        },
        fetchMock as typeof fetch,
      ),
    ).rejects.toThrow("webhook notification failed");
  });

  it("does nothing when no destinations are bound", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));

    await dispatchNotificationEvent(
      [],
      {
        kind: "transition",
        monitor,
        status: "down",
        checkedAt: "2026-05-04T10:00:00.000Z",
        error: "timeout",
      },
      fetchMock as typeof fetch,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows provider failures so one broken destination does not abort delivery", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      dispatchNotificationEvent(
        [discordDestination, webhookDestination, telegramDestination],
        {
          kind: "transition",
          monitor,
          status: "down",
          checkedAt: "2026-05-04T10:00:00.000Z",
          error: "timeout",
        },
        fetchMock as typeof fetch,
      ),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
