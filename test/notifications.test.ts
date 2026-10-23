import type { z } from "zod";

import * as schema from "@schema";
import { describe, expect, it } from "vitest";
import { and, db, eq } from "void/db";

import {
  type NotificationDestination,
  NotificationInput,
} from "@/lib/schemas/notifications";
import * as monitors from "@/modules/monitors/monitors.service";
import * as notifications from "@/modules/notifications/notifications.service";
import {
  deliverNotification,
  type NotificationEvent,
} from "@/modules/notifications/providers";

import { respondWith, seedMonitor, setNow, stubFetch } from "./support";

const input = (value: z.input<typeof NotificationInput>) =>
  NotificationInput.parse(value);

const monitor = {
  id: "monitor-api",
  name: "API Gateway",
  kind: "http",
  target: "https://status.example.com/health",
} as const;

const timestamps = {
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const webhookDestination: NotificationDestination = {
  id: "dest-webhook",
  name: "Ops Webhook",
  provider: "webhook",
  config: {
    url: "https://example.com/hook",
    headers: [{ key: "x-api-key", value: "secret" }],
  },
  ...timestamps,
};

const discordDestination: NotificationDestination = {
  id: "dest-discord",
  name: "Ops Discord",
  provider: "discord",
  config: { webhookUrl: "https://discord.com/api/webhooks/1/abc" },
  ...timestamps,
};

const telegramDestination: NotificationDestination = {
  id: "dest-telegram",
  name: "Ops Telegram",
  provider: "telegram",
  config: {
    botToken: "123456:abcdef",
    chatId: "-100100200300",
    messageThreadId: "42",
  },
  ...timestamps,
};

const transition = (
  status: "up" | "down",
  error: string | null,
): NotificationEvent => ({
  kind: "transition",
  monitor,
  status,
  checkedAt: "2026-05-04T10:00:00.000Z",
  error,
});

const testEvent = (
  destination: NotificationDestination,
): NotificationEvent => ({
  kind: "test",
  sentAt: "2026-05-04T10:10:00.000Z",
  destination: {
    id: destination.id,
    name: destination.name,
    provider: destination.provider,
  },
});

type RecordedRequest = {
  url: string;
  headers: Headers;
  body: string;
};

/** Records outbound requests and answers each with `status(url)`. */
const recordRequests = (status: (url: string) => number = () => 200) => {
  const requests: RecordedRequest[] = [];

  const handler: typeof fetch = async (request, init) => {
    const url = String(request);

    requests.push({
      url,
      headers: new Headers(init?.headers),
      body: String(init?.body),
    });

    return new Response(null, { status: status(url) });
  };

  stubFetch(handler);

  return { requests, restore: () => stubFetch(handler) };
};

const bodyOf = (request: RecordedRequest | undefined) =>
  JSON.parse(request?.body ?? "null");

describe("notification delivery", () => {
  it("posts the transition payload shape to webhook destinations", async () => {
    const recorder = recordRequests();

    await deliverNotification(
      webhookDestination,
      transition("down", "HTTP 500"),
    );

    const [request] = recorder.requests;

    expect(recorder.requests).toHaveLength(1);
    expect(request?.url).toBe("https://example.com/hook");
    expect(request?.headers.get("content-type")).toBe("application/json");
    expect(request?.headers.get("x-api-key")).toBe("secret");
    expect(bodyOf(request)).toEqual({
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
    const recorder = recordRequests();

    await deliverNotification(
      discordDestination,
      transition("down", "timeout"),
    );

    const [request] = recorder.requests;
    const [embed] = bodyOf(request).embeds;

    expect(request?.url).toBe("https://discord.com/api/webhooks/1/abc");
    expect(embed.title).toBe("Monitor down: API Gateway");
    expect(embed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Status", value: "DOWN" }),
        expect.objectContaining({ name: "Error", value: "timeout" }),
      ]),
    );
  });

  it("sends compact Telegram messages to the configured thread", async () => {
    const recorder = recordRequests();

    await deliverNotification(telegramDestination, transition("up", null));
    await deliverNotification(
      telegramDestination,
      transition("down", "Expected HTTP 200, got 502"),
    );

    const [recovered, down] = recorder.requests;

    expect(recovered?.url).toBe(
      "https://api.telegram.org/bot123456:abcdef/sendMessage",
    );
    expect(bodyOf(recovered)).toEqual({
      chat_id: "-100100200300",
      message_thread_id: "42",
      text: [
        "API Gateway",
        "[http] [✅ Up] recovered",
        "https://status.example.com/health",
      ].join("\n"),
    });
    expect(bodyOf(down).text).toBe(
      [
        "API Gateway",
        "[http] [🔴 Down] Expected HTTP 200, got 502",
        "https://status.example.com/health",
      ].join("\n"),
    );
  });

  it("posts test payloads for every provider", async () => {
    const recorder = recordRequests();

    for (const destination of [
      discordDestination,
      webhookDestination,
      telegramDestination,
    ]) {
      await deliverNotification(destination, testEvent(destination));
    }

    const [discord, webhook, telegram] = recorder.requests.map(bodyOf);

    expect(discord.embeds[0].title).toBe("Test notification: Ops Discord");
    expect(webhook.kind).toBe("notification.test");
    expect(telegram.text).toContain("Test notification: Ops Telegram");
  });

  it("fails test sends with the destination and status", async () => {
    const recorder = recordRequests(() => 500);

    const created = await notifications.create(
      input({
        name: "Ops Webhook",
        provider: "webhook",
        url: "https://example.com/hook",
      }),
    );

    await expect(notifications.sendTest(created.id)).rejects.toThrow(
      "webhook notification failed for Ops Webhook: HTTP 500.",
    );
    expect(recorder.requests).toHaveLength(1);
  });
});

describe("notification destinations", () => {
  it("saves provider config and deduplicates monitor bindings", async () => {
    const seeded = await seedMonitor();

    const created = await notifications.create(
      input({
        name: "Ops webhook",
        provider: "webhook",
        url: "https://example.com/hook",
        headers: [{ key: " x-api-key ", value: "secret" }],
        monitorIds: [seeded.id, seeded.id],
      }),
    );

    expect(created).toMatchObject({
      name: "Ops webhook",
      provider: "webhook",
      config: {
        url: "https://example.com/hook",
        headers: [{ key: "x-api-key", value: "secret" }],
      },
      monitorIds: [seeded.id],
    });
  });

  it("rejects bindings to unknown monitors without saving", async () => {
    const seeded = await seedMonitor();

    const webhook = (monitorIds: Array<string>) =>
      input({
        name: "Ops webhook",
        provider: "webhook",
        url: "https://example.com/hook",
        monitorIds,
      });

    await expect(
      notifications.create(webhook([seeded.id, "missing"])),
    ).rejects.toThrow("Unknown monitor ids: missing");
    expect(await notifications.destinations()).toEqual([]);

    const created = await notifications.create(webhook([seeded.id]));

    await expect(
      notifications.update(created.id, webhook(["missing"])),
    ).rejects.toThrow("Unknown monitor ids: missing");
    expect((await notifications.detail(created.id)).monitorIds).toEqual([
      seeded.id,
    ]);
  });
});

describe("notification outbox", () => {
  const deliveriesFor = (monitorId: string, status: "up" | "down") =>
    db
      .select()
      .from(schema.notificationDeliveries)
      .where(
        and(
          eq(schema.notificationDeliveries.monitorId, monitorId),
          eq(schema.notificationDeliveries.status, status),
        ),
      );

  /** A push monitor that is overdue at 12:05, with one webhook per name. */
  const overduePushMonitor = async (
    destinationNames: ReadonlyArray<string>,
  ) => {
    setNow("2026-05-01T12:05:00.000Z");
    const seeded = await seedMonitor({ kind: "push", lastStatus: "up" });

    for (const name of destinationNames) {
      await notifications.create(
        input({
          name,
          provider: "webhook",
          url: `https://${name}.example`,
          monitorIds: [seeded.id],
        }),
      );
    }

    expect(await monitors.runScheduledCheck(seeded.id)).toBe("checked");

    const { pushToken } = seeded;

    if (!pushToken) throw new Error("push token missing");

    return {
      id: seeded.id,
      recover: () => monitors.recordHeartbeat(pushToken),
    };
  };

  it("retries only failed destinations and keeps undelivered recoveries", async () => {
    const recorder = recordRequests((url) =>
      url.includes("second") ? 503 : 200,
    );

    const seeded = await overduePushMonitor(["first", "second"]);

    await notifications.deliverDue();
    await notifications.deliverDue();

    // The failed destination is backed off, so the second run sends nothing.
    expect(recorder.requests).toHaveLength(2);

    const downs = await deliveriesFor(seeded.id, "down");

    expect(downs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attempts: 0,
          deliveredAt: expect.any(String),
        }),
        expect.objectContaining({ attempts: 1, deliveredAt: null }),
      ]),
    );

    await seeded.recover();

    // Only the destination that received the down alert gets a recovery.
    const recovery = await deliveriesFor(seeded.id, "up");

    expect(recovery).toHaveLength(1);
    expect(recovery[0]?.destinationId).toBe(
      downs.find((delivery) => delivery.deliveredAt !== null)?.destinationId,
    );

    respondWith(503, null);
    await notifications.deliverDue();

    expect(await deliveriesFor(seeded.id, "up")).toEqual([
      expect.objectContaining({ deliveredAt: null, attempts: 1 }),
    ]);
  });

  it("queues a recovery when a retried down alert lands after the monitor recovered", async () => {
    const recorder = recordRequests();
    const seeded = await overduePushMonitor(["ops"]);

    respondWith(503, null);
    await notifications.deliverDue();

    // An attempted down alert survives the recovery but gets no recovery yet.
    await seeded.recover();
    expect(await deliveriesFor(seeded.id, "up")).toHaveLength(0);

    recorder.restore();
    setNow("2026-05-01T12:05:30.000Z");
    await notifications.deliverDue();
    await notifications.deliverDue();

    expect(recorder.requests.map((request) => bodyOf(request).kind)).toEqual([
      "monitor.down",
      "monitor.recovered",
    ]);
    expect(await deliveriesFor(seeded.id, "up")).toEqual([
      expect.objectContaining({ deliveredAt: expect.any(String) }),
    ]);
  });
});
