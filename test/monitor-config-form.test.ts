import { describe, expect, it } from "vitest";

import type { MonitorAssertion, MonitorRecord } from "@/types";

import {
  addMonitorAssertion,
  applyMonitorKindChange,
  createBodyJsonAssertion,
  createDnsAssertion,
  createHeaderAssertion,
  createStatusAssertion,
  getMonitorConfigFormDefaults,
  removeMonitorAssertion,
  updateMonitorAssertion,
  validateMonitorConfigForm,
} from "@/lib/monitor/form";

describe("monitor config form helpers", () => {
  it("creates new monitor defaults", () => {
    const defaults = getMonitorConfigFormDefaults();

    expect(defaults).toMatchObject({
      name: "",
      kind: "http",
      target: "",
      intervalSec: 60,
      timeoutMs: 10000,
      retries: 0,
      active: true,
      notificationDestinationIds: [],
    });
    expect(defaults.assertions).toHaveLength(1);
    expect(defaults.assertions[0]).toMatchObject({
      type: "status",
      expected: 200,
    });
  });

  it("creates existing monitor defaults", () => {
    const assertion = createDnsAssertion();
    const defaults = getMonitorConfigFormDefaults(
      createMonitorRecord({
        active: 0,
        assertions: [assertion],
        kind: "dns",
        name: "DNS",
        target: "example.com",
      }),
      ["destination-1"],
    );

    expect(defaults).toMatchObject({
      active: false,
      assertions: [assertion],
      kind: "dns",
      name: "DNS",
      notificationDestinationIds: ["destination-1"],
      target: "example.com",
    });
  });

  it("keeps record assertions when switching to DNS and creates a default record when empty", () => {
    const record = createDnsAssertion();
    const status = createStatusAssertion();

    expect(
      applyMonitorKindChange(
        { assertions: [status, record], target: "example.com" },
        "dns",
      ),
    ).toEqual({ assertions: [record], target: "example.com" });

    const next = applyMonitorKindChange(
      { assertions: [status], target: "example.com" },
      "dns",
    );
    expect(next.target).toBe("example.com");
    expect(next.assertions).toHaveLength(1);
    expect(next.assertions[0]?.type).toBe("record");
  });

  it("keeps HTTP assertions when switching to HTTP and creates a default status when empty", () => {
    const record = createDnsAssertion();
    const header = createHeaderAssertion();

    expect(
      applyMonitorKindChange(
        { assertions: [record, header], target: "https://example.com" },
        "http",
      ),
    ).toEqual({ assertions: [header], target: "https://example.com" });

    const next = applyMonitorKindChange(
      { assertions: [record], target: "https://example.com" },
      "http",
    );
    expect(next.target).toBe("https://example.com");
    expect(next.assertions).toHaveLength(1);
    expect(next.assertions[0]).toMatchObject({
      type: "status",
      expected: 200,
    });
  });

  it("clears target and assertions when switching to push", () => {
    expect(
      applyMonitorKindChange(
        {
          assertions: [createStatusAssertion()],
          target: "https://example.com",
        },
        "push",
      ),
    ).toEqual({ assertions: [], target: "" });
  });

  it("adds, updates, and removes assertions", () => {
    const status = createStatusAssertion();
    const header = createHeaderAssertion();
    const added = addMonitorAssertion([status], header);

    expect(added).toEqual([status, header]);

    const updatedHeader = { ...header, value: "text/html" };
    expect(updateMonitorAssertion(added, updatedHeader)).toEqual([
      status,
      updatedHeader,
    ]);
    expect(removeMonitorAssertion(added, status.id)).toEqual([header]);
  });

  it("filters submit assertions by monitor kind", () => {
    const status = createStatusAssertion();
    const record = createDnsAssertion();
    const json = createBodyJsonAssertion();

    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "http",
        assertions: [status, record, json],
      }),
    ).toMatchObject({
      ok: true,
      payload: { assertions: [status, json] },
    });

    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "dns",
        target: "example.com",
        assertions: [status, record, json],
      }),
    ).toMatchObject({
      ok: true,
      payload: { assertions: [record] },
    });

    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "push",
        target: "",
        assertions: [status, record, json],
      }),
    ).toMatchObject({
      ok: true,
      payload: { assertions: [] },
    });
  });

  it("returns validation errors for invalid payloads", () => {
    expect(validateMonitorConfigForm({ ...validState(), name: "" })).toEqual({
      ok: false,
      error: "Name is required.",
    });
    expect(validateMonitorConfigForm({ ...validState(), target: "" })).toEqual({
      ok: false,
      error: "Target is required.",
    });
    expect(
      validateMonitorConfigForm({ ...validState(), intervalSec: 0 }),
    ).toEqual({
      ok: false,
      error: "Use an interval of at least 60 seconds.",
    });
    expect(
      validateMonitorConfigForm({ ...validState(), timeoutMs: 0 }),
    ).toEqual({
      ok: false,
      error: "Use a timeout above 0.",
    });
    expect(validateMonitorConfigForm({ ...validState(), retries: -1 })).toEqual(
      {
        ok: false,
        error: "Retries cannot be negative.",
      },
    );
    expect(
      validateMonitorConfigForm({ ...validState(), timeoutMs: 30_001 }),
    ).toEqual({
      ok: false,
      error: "Use a timeout of 30 seconds or less.",
    });
    expect(validateMonitorConfigForm({ ...validState(), retries: 2 })).toEqual({
      ok: false,
      error: "Use no more than 1 retry.",
    });
    expect(
      validateMonitorConfigForm({
        ...validState(),
        notificationDestinationIds: Array.from(
          { length: 9 },
          (_, index) => `destination-${index}`,
        ),
      }),
    ).toEqual({
      ok: false,
      error: "Choose no more than 8 notification destinations.",
    });
    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "dns",
        target: "example.com",
        assertions: [createStatusAssertion()],
      }),
    ).toEqual({
      ok: false,
      error: "DNS monitors need at least one record assertion.",
    });
  });

  it("validates cron heartbeat settings for push monitors", () => {
    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "push",
        target: "",
        assertions: [],
        heartbeatMode: "cron",
        heartbeatCron: "",
      }),
    ).toEqual({
      ok: false,
      error: "Cron expression is required.",
    });

    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "push",
        target: "",
        assertions: [],
        heartbeatMode: "cron",
        heartbeatCron: "not a cron",
      }),
    ).toEqual({
      ok: false,
      error: "Use a valid cron expression.",
    });

    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "push",
        target: "",
        assertions: [],
        heartbeatMode: "cron",
        heartbeatTimezone: "Mars/Base",
      }),
    ).toEqual({
      ok: false,
      error: "Use a valid IANA timezone.",
    });
  });

  it("keeps cron heartbeat settings only for push cron monitors", () => {
    const pushResult = validateMonitorConfigForm({
      ...validState(),
      kind: "push",
      target: "",
      assertions: [createStatusAssertion()],
      heartbeatMode: "cron",
      heartbeatCron: "*/15 * * * *",
      heartbeatGraceSec: 120,
      heartbeatTimezone: "America/New_York",
      notificationGraceSec: 180,
    });

    expect(pushResult).toMatchObject({
      ok: true,
      payload: {
        assertions: [],
        heartbeatMode: "cron",
        heartbeatCron: "*/15 * * * *",
        heartbeatGraceSec: 120,
        heartbeatTimezone: "America/New_York",
        notificationGraceSec: 180,
      },
    });

    expect(
      validateMonitorConfigForm({
        ...validState(),
        kind: "http",
        heartbeatMode: "cron",
        heartbeatCron: "*/15 * * * *",
        heartbeatGraceSec: 120,
        heartbeatTimezone: "America/New_York",
      }),
    ).toMatchObject({
      ok: true,
      payload: {
        heartbeatMode: "interval",
        heartbeatCron: null,
        heartbeatGraceSec: null,
        heartbeatTimezone: null,
      },
    });
  });
});

function validState() {
  return {
    name: "Homepage",
    kind: "http" as const,
    target: "https://example.com",
    intervalSec: 60,
    timeoutMs: 10000,
    retries: 0,
    assertions: [createStatusAssertion()],
    heartbeatMode: "interval" as const,
    heartbeatCron: "0 * * * *",
    heartbeatGraceSec: 300,
    heartbeatTimezone: "UTC",
    notificationGraceSec: 0,
    active: true,
    notificationDestinationIds: [],
  };
}

function createMonitorRecord(
  overrides: Partial<MonitorRecord> & {
    assertions?: MonitorAssertion[];
  } = {},
): MonitorRecord {
  return {
    id: "monitor-1",
    name: "Monitor",
    kind: "http",
    target: "https://example.com",
    intervalSec: 60,
    timeoutMs: 10000,
    retries: 0,
    assertions: [createStatusAssertion()],
    heartbeatMode: "interval",
    heartbeatCron: "0 * * * *",
    heartbeatGraceSec: 300,
    heartbeatTimezone: "UTC",
    notificationGraceSec: 0,
    pushToken: null,
    active: 1,
    lastStatus: "unknown",
    lastCheckedAt: null,
    lastDurationMs: null,
    lastError: null,
    lastDownNotifiedAt: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}
