import * as schema from "@schema";
import { vi } from "vitest";
import { db } from "void/db";

import * as monitors from "@/modules/monitors/monitors.service";

/** Freezes `Date` at `iso`; timers and promises keep running for real. */
export function setNow(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

/** Answers every outbound request (probes, notifications) with `handler`. */
export function stubFetch(handler: typeof fetch) {
  const mock = vi.fn(handler);

  vi.stubGlobal("fetch", mock);

  return mock;
}

export function respondWith(status: number, body: BodyInit | null = "ok") {
  return stubFetch(async () => new Response(body, { status }));
}

type MonitorRow = typeof schema.monitors.$inferInsert;

/** Inserts a monitor row directly, bypassing create-time checks. */
export async function seedMonitor(
  payload: Partial<Omit<MonitorRow, "assertionsJson">> & {
    readonly assertions?: ReadonlyArray<unknown>;
  } = {},
) {
  const now = payload.createdAt ?? "2026-05-01T12:00:00.000Z";
  const kind = payload.kind ?? "http";
  const id = payload.id ?? crypto.randomUUID();
  const { assertions = [], ...row } = payload;

  await db.insert(schema.monitors).values({
    name: "API",
    target: kind === "push" ? "" : "http://example.com",
    intervalSec: 60,
    timeoutMs: 1000,
    retries: 0,
    pushToken: kind === "push" ? crypto.randomUUID() : null,
    updatedAt: now,
    ...row,
    id,
    kind,
    assertionsJson: JSON.stringify(assertions),
    createdAt: now,
  });

  return monitors.get(id);
}
