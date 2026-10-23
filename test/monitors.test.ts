import { isNotFound } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  MonitorConfig,
  type MonitorConfigInput,
} from "@/lib/schemas/monitor-config";
import * as monitors from "@/modules/monitors/monitors.service";

import { respondWith, seedMonitor, setNow } from "./support";

const config = (input: MonitorConfigInput) => MonitorConfig.parse(input);

/** Inserts `count` heartbeats `stepMinutes` apart, newest at `newest`. */
function insertHeartbeats(
  monitorId: string,
  options: {
    readonly count: number;
    readonly newest: string;
    readonly stepMinutes: number;
    readonly downAt?: number;
  },
) {
  return env.DB.prepare(
    `WITH RECURSIVE checks(value) AS (
      VALUES(1) UNION ALL SELECT value + 1 FROM checks WHERE value < ?
    )
    INSERT INTO heartbeats (
      id, monitorId, status, statusCode, durationMs, error, createdAt, source
    )
    SELECT printf('heartbeat-%05d', value), ?,
      CASE WHEN value = ? THEN 'down' ELSE 'up' END, 200, 10, NULL,
      strftime('%Y-%m-%dT%H:%M:%fZ', ?, '-' || ((value - 1) * ?) || ' minutes'),
      'poll'
    FROM checks`,
  )
    .bind(
      options.count,
      monitorId,
      options.downAt ?? 0,
      options.newest,
      options.stepMinutes,
    )
    .run();
}

describe("monitor configuration", () => {
  it("creates and updates monitors", async () => {
    const created = await monitors.create(
      config({
        name: "API",
        kind: "http",
        target: "https://example.com/health",
        retries: 1,
        active: false,
        assertions: [{ id: "status", type: "status", expected: 200 }],
      }),
    );

    expect(created).toMatchObject({
      name: "API",
      kind: "http",
      active: false,
      pushToken: null,
      assertions: [{ id: "status", type: "status", expected: 200 }],
    });

    const updated = await monitors.update(
      created.id,
      config({
        name: "API edge",
        kind: "http",
        target: "https://example.com/ready",
        intervalSec: 120,
        active: false,
      }),
    );

    expect(updated).toMatchObject({
      id: created.id,
      name: "API edge",
      target: "https://example.com/ready",
      intervalSec: 120,
      assertions: [],
      revision: created.revision + 1,
    });

    await expect(
      monitors.update("missing", config({ name: "Job", kind: "push" })),
    ).rejects.toSatisfy(isNotFound);
  });

  it("runs the first check of an active poll monitor right away", async () => {
    respondWith(200);

    const created = await monitors.create(
      config({ name: "API", kind: "http", target: "https://example.com" }),
    );

    const { heartbeats } = await monitors.logs(created.id, 1);

    expect(heartbeats).toEqual([
      expect.objectContaining({ source: "poll", status: "up" }),
    ]);
  });

  it("gives every push monitor its own token and keeps it across edits", async () => {
    const input: MonitorConfigInput = { name: "Job", kind: "push" };
    const first = await monitors.create(config(input));
    const copy = await monitors.create(config(input));

    expect(first.pushToken).toEqual(expect.any(String));
    expect(copy.pushToken).not.toBe(first.pushToken);

    const edited = await monitors.update(
      first.id,
      config({ ...input, name: "Renamed job" }),
    );

    expect(edited.pushToken).toBe(first.pushToken);

    const rotated = await monitors.rotatePushToken(first.id);

    expect(rotated.pushToken).toEqual(expect.any(String));
    expect(rotated.pushToken).not.toBe(first.pushToken);

    // Only push monitors have a token to rotate.
    const http = await seedMonitor();

    await expect(monitors.rotatePushToken(http.id)).rejects.toSatisfy(
      isNotFound,
    );
  });

  it("pauses and resumes monitors", async () => {
    const monitor = await seedMonitor();

    expect(await monitors.setActive(monitor.id, false)).toMatchObject({
      active: false,
    });
    expect(await monitors.setActive(monitor.id, true)).toMatchObject({
      active: true,
    });

    await expect(monitors.setActive("missing", true)).rejects.toSatisfy(
      isNotFound,
    );
  });
});

describe("monitor detail", () => {
  it("returns every heartbeat of the last 48 hours", async () => {
    setNow("2026-05-03T12:00:00.000Z");
    const monitor = await seedMonitor();

    // 1440 checks two minutes apart span the 48 hours before now.
    await insertHeartbeats(monitor.id, {
      count: 1440,
      newest: "2026-05-03T12:00:00.000Z",
      stepMinutes: 2,
    });

    const detail = await monitors.detail(monitor.id);

    expect(detail.heartbeats).toHaveLength(1440);
  });

  it("aggregates availability beyond the displayed sample", async () => {
    setNow("2026-05-03T12:00:00.000Z");
    const monitor = await seedMonitor();

    await insertHeartbeats(monitor.id, {
      count: 6001,
      newest: "2026-05-03T12:00:00.000Z",
      stepMinutes: 0,
      downAt: 6001,
    });

    const { heartbeats, metrics } = await monitors.detail(monitor.id);

    expect(heartbeats).toHaveLength(6000);
    expect(metrics.requestCount).toBe(6001);
    expect(metrics.windows[0]).toMatchObject({
      days: 7,
      totalChecks: 6001,
      upChecks: 6000,
    });
  });
});

describe("monitor tests", () => {
  const unsaved = config({
    name: "Unsaved API",
    kind: "http",
    target: "https://example.com/health",
    timeoutMs: 1000,
    assertions: [{ id: "status", type: "status", expected: 200 }],
  });

  it("reports a passing check", async () => {
    respondWith(200);

    expect(await monitors.test(unsaved)).toMatchObject({
      status: "up",
      statusCode: 200,
      error: null,
    });
  });

  it("returns a failed outcome after the configured retry", async () => {
    const fetchMock = respondWith(503, "unavailable");

    const result = await monitors.test({ ...unsaved, retries: 1 });

    expect(result).toMatchObject({
      status: "down",
      statusCode: 503,
      error: "Expected HTTP 200, got 503",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cannot test push monitors", async () => {
    await expect(
      monitors.test(config({ name: "Job", kind: "push" })),
    ).rejects.toBeInstanceOf(AppError);
  });
});
