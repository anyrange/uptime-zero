import * as schema from "@schema";
import { describe, expect, it } from "vitest";
import { db } from "void/db";

import * as monitors from "@/modules/monitors/monitors.service";
import * as notifications from "@/modules/notifications/notifications.service";

const timestamps = {
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

// Rows written by older versions must keep reading back as current values.
describe("stored rows", () => {
  it("reads telegram configs saved before forum topics", async () => {
    await db.insert(schema.notificationDestinations).values({
      id: "telegram",
      name: "Ops Telegram",
      provider: "telegram",
      configJson: JSON.stringify({ botToken: "bot", chatId: "123" }),
      ...timestamps,
    });

    expect(await notifications.detail("telegram")).toMatchObject({
      provider: "telegram",
      config: { botToken: "bot", chatId: "123", messageThreadId: null },
    });
  });

  it("reads monitors without stored assertions", async () => {
    await db.insert(schema.monitors).values({
      id: "legacy",
      name: "Legacy",
      kind: "http",
      target: "https://example.com",
      intervalSec: 60,
      timeoutMs: 1000,
      retries: 0,
      assertionsJson: null,
      heartbeatMode: "interval",
      ...timestamps,
    });

    expect(await monitors.get("legacy")).toMatchObject({
      assertions: [],
      active: true,
    });
  });
});
