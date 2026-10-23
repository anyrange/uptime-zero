import * as schema from "@schema";
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { db } from "void/db";

import {
  StatusPageInput,
  type StatusPageInputEncoded,
} from "@/lib/schemas/status-pages";
import * as monitorsRepo from "@/modules/monitors/monitors.repository";
import * as settings from "@/modules/settings/settings.service";
import * as statusPages from "@/modules/status-pages/status-pages.service";

import { seedMonitor, setNow } from "./support";

/**
 * Public pages are cached per slug in the Cache API, which outlives a test,
 * so every page gets its own slug.
 */
const pageInput = (overrides: Partial<StatusPageInputEncoded> = {}) =>
  StatusPageInput.parse({
    slug: crypto.randomUUID(),
    title: "Status",
    published: true,
    showHistory: true,
    ...overrides,
  });

describe("public status", () => {
  it("does not expose targets, tokens, assertions or incident bodies", async () => {
    setNow("2026-05-01T12:05:00.000Z");
    const target = "https://secret.example.com/health?token=hunter2";

    const monitor = await seedMonitor({
      target,
      assertions: [{ id: "status", type: "status", expected: 200 }],
    });

    const push = await seedMonitor({ kind: "push" });

    await monitorsRepo.recordCheck(
      monitor,
      {
        status: "down",
        statusCode: 500,
        durationMs: 10,
        error: `GET ${target} returned 500`,
      },
      "poll",
      "2026-05-01T12:04:00.000Z",
    );

    const { page } = await statusPages.create(
      pageInput({ monitorIds: [monitor.id, push.id] }),
    );

    const data = await statusPages.publicPage(page.slug);
    const serialized = JSON.stringify(data);

    expect(data.monitors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: monitor.id, target: null }),
      ]),
    );
    expect(data.incidents).toEqual([
      expect.objectContaining({ monitorId: monitor.id, body: null }),
    ]);
    expect(data.status).toBe("down");
    expect(serialized).not.toContain("secret.example.com");
    expect(serialized).not.toContain("assertions");
    expect(serialized).not.toContain(push.pushToken ?? "missing-token");
  });

  it("shows targets only when the page opts in", async () => {
    const monitor = await seedMonitor({ target: "https://api.example.com" });

    const { page } = await statusPages.create(
      pageInput({ showTarget: true, monitorIds: [monitor.id] }),
    );

    expect((await statusPages.publicPage(page.slug)).monitors).toEqual([
      expect.objectContaining({ target: "https://api.example.com" }),
    ]);
  });

  it("does not serve unpublished pages", async () => {
    const { page } = await statusPages.create(pageInput({ published: false }));

    await expect(statusPages.publicPage(page.slug)).rejects.toSatisfy(
      isNotFound,
    );
  });

  it("dedupes linked monitors and aggregates history per monitor and day", async () => {
    setNow("2026-05-02T12:00:00.000Z");
    const busy = await seedMonitor({ name: "Busy API" });
    const quiet = await seedMonitor({ name: "Quiet API" });

    const heartbeat = (monitorId: string, createdAt: string) => ({
      id: crypto.randomUUID(),
      monitorId,
      status: "up" as const,
      statusCode: 200,
      durationMs: 100,
      error: null,
      createdAt,
      source: "poll" as const,
    });

    const heartbeats = [
      ...Array.from({ length: 50 }, (_, index) =>
        heartbeat(
          busy.id,
          new Date(Date.UTC(2026, 4, 1, 12, index)).toISOString(),
        ),
      ),
      heartbeat(quiet.id, "2026-05-01T11:00:00.000Z"),
    ];

    // One row per insert stays below D1's bound parameter limit.
    for (const row of heartbeats) {
      await db.insert(schema.heartbeats).values(row);
    }

    await settings.updateRetention({
      heartbeatRetentionDays: 365,
      incidentRetentionDays: 90,
    });

    const created = await statusPages.create(
      pageInput({ monitorIds: [busy.id, quiet.id, quiet.id] }),
    );

    expect(created.monitorIds).toEqual([busy.id, quiet.id]);

    const data = await statusPages.publicPage(created.page.slug);

    const totals = new Map(
      data.uptime.map((row) => [row.monitorId, row.total]),
    );

    expect(data.monitors).toHaveLength(2);
    expect(data.history.filter((row) => row.monitorId === busy.id)).toEqual([
      expect.objectContaining({ day: "2026-05-01", up: 50, down: 0 }),
    ]);
    expect(totals.get(busy.id)).toBe(50);
    expect(totals.get(quiet.id)).toBe(1);
  });
});
