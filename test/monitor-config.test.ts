import type { z } from "zod";

import { describe, expect, it } from "vitest";

import type { Monitor } from "@/lib/schemas/monitors";

import {
  applyMonitorKindChange,
  assertionsForKind,
  createBodyJsonAssertion,
  createDnsAssertion,
  createHeaderAssertion,
  createStatusAssertion,
  MonitorConfig,
  type MonitorConfigInput,
  monitorConfigDefaults,
  MonitorExport,
  type MonitorExportInput,
  normalizeMonitorConfig,
} from "@/lib/schemas/monitor-config";
import { m } from "@/paraglide/messages.js";

/** Parses like the form and server functions do, collecting every issue. */
function decode<S extends z.ZodType>(schema: S, input: z.input<S>) {
  const result = schema.safeParse(input);

  if (result.success) return { ok: true as const, value: result.data };

  return {
    ok: false as const,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}

const validInput = (
  overrides: Partial<MonitorConfigInput> = {},
): MonitorConfigInput => ({
  name: "Homepage",
  kind: "http",
  target: "https://example.com",
  assertions: [createStatusAssertion()],
  ...overrides,
});

const issuesOf = (overrides: Partial<MonitorConfigInput>) => {
  const result = decode(MonitorConfig, validInput(overrides));

  return result.ok ? [] : result.issues;
};

describe("monitor config schema", () => {
  it("fills defaults for omitted fields", () => {
    expect(
      decode(MonitorConfig, { name: " API ", kind: "push" }),
    ).toMatchObject({
      ok: true,
      value: {
        name: "API",
        target: "",
        intervalSec: 60,
        timeoutMs: 10_000,
        retries: 0,
        assertions: [],
        heartbeatMode: "interval",
        notificationGraceSec: 0,
        active: true,
        notificationDestinationIds: [],
      },
    });
  });

  it("reports field errors with their messages", () => {
    expect(issuesOf({ name: " " })).toEqual([
      { path: "name", message: m.validation_name_required() },
    ]);
    expect(issuesOf({ intervalSec: 59 })).toEqual([
      { path: "intervalSec", message: m.validation_interval_minimum() },
    ]);
    expect(issuesOf({ timeoutMs: 0 })).toEqual([
      { path: "timeoutMs", message: m.validation_timeout_positive() },
    ]);
    expect(issuesOf({ timeoutMs: 30_001 })).toEqual([
      { path: "timeoutMs", message: m.validation_timeout_maximum() },
    ]);
    expect(issuesOf({ retries: -1 })).toEqual([
      { path: "retries", message: m.validation_retries_nonnegative() },
    ]);
    expect(issuesOf({ retries: 2 })).toEqual([
      { path: "retries", message: m.validation_retries_maximum() },
    ]);
    expect(
      issuesOf({
        notificationDestinationIds: Array.from(
          { length: 9 },
          (_, index) => `destination-${index}`,
        ),
      }),
    ).toEqual([
      {
        path: "notificationDestinationIds",
        message: m.validation_notification_destinations_maximum(),
      },
    ]);
  });

  it("requires a target for poll monitors and a record assertion for DNS", () => {
    expect(issuesOf({ target: " " })).toEqual([
      { path: "target", message: m.validation_target_required() },
    ]);
    expect(issuesOf({ kind: "push", target: "" })).toEqual([]);
    expect(
      issuesOf({
        kind: "dns",
        target: "example.com",
        assertions: [createStatusAssertion()],
      }),
    ).toEqual([
      { path: "assertions", message: m.validation_dns_assertion_required() },
    ]);
  });

  it("validates cron heartbeat settings for push monitors", () => {
    const cron = (overrides: Partial<MonitorConfigInput>) =>
      issuesOf({
        kind: "push",
        target: "",
        assertions: [],
        heartbeatMode: "cron",
        heartbeatCron: "0 * * * *",
        heartbeatTimezone: "UTC",
        ...overrides,
      });

    expect(cron({})).toEqual([]);
    expect(cron({ heartbeatCron: " " })).toEqual([
      {
        path: "heartbeatCron",
        message: m.validation_heartbeat_cron_required(),
      },
    ]);
    expect(cron({ heartbeatCron: "not a cron" })).toEqual([
      { path: "heartbeatCron", message: m.validation_heartbeat_cron_invalid() },
    ]);
    expect(cron({ heartbeatTimezone: "Mars/Base" })).toEqual([
      {
        path: "heartbeatTimezone",
        message: m.validation_heartbeat_timezone_invalid(),
      },
    ]);
  });
});

describe("monitor config helpers", () => {
  it("creates new monitor defaults", () => {
    const defaults = monitorConfigDefaults();

    expect(defaults).toMatchObject({
      name: "",
      kind: "http",
      target: "",
      intervalSec: 60,
      timeoutMs: 10_000,
      retries: 0,
      active: true,
      notificationDestinationIds: [],
    });
    expect(defaults.assertions).toEqual([
      expect.objectContaining({ type: "status", expected: 200 }),
    ]);
  });

  it("creates defaults from a saved monitor", () => {
    const assertion = createDnsAssertion();

    expect(
      monitorConfigDefaults(
        savedMonitor({
          active: false,
          assertions: [assertion],
          kind: "dns",
          name: "DNS",
          target: "example.com",
        }),
        ["destination-1"],
      ),
    ).toMatchObject({
      active: false,
      assertions: [assertion],
      kind: "dns",
      name: "DNS",
      notificationDestinationIds: ["destination-1"],
      target: "example.com",
    });
  });

  it("keeps compatible assertions on kind change or seeds a default", () => {
    const record = createDnsAssertion();
    const status = createStatusAssertion();
    const header = createHeaderAssertion();

    expect(
      applyMonitorKindChange(
        { assertions: [status, record], target: "example.com" },
        "dns",
      ),
    ).toEqual({ assertions: [record], target: "example.com" });
    expect(
      applyMonitorKindChange({ assertions: [status], target: "a" }, "dns")
        .assertions,
    ).toEqual([expect.objectContaining({ type: "record" })]);
    expect(
      applyMonitorKindChange(
        { assertions: [record, header], target: "a" },
        "http",
      ),
    ).toEqual({ assertions: [header], target: "a" });
    expect(
      applyMonitorKindChange({ assertions: [record], target: "a" }, "http")
        .assertions,
    ).toEqual([expect.objectContaining({ type: "status", expected: 200 })]);
    expect(
      applyMonitorKindChange({ assertions: [status], target: "a" }, "push"),
    ).toEqual({ assertions: [], target: "" });
  });

  it("filters assertions by monitor kind", () => {
    const status = createStatusAssertion();
    const record = createDnsAssertion();
    const json = createBodyJsonAssertion();
    const all = [status, record, json];

    expect(assertionsForKind("http", all)).toEqual([status, json]);
    expect(assertionsForKind("dns", all)).toEqual([record]);
    expect(assertionsForKind("push", all)).toEqual([]);
  });

  it("keeps cron heartbeat settings only for push cron monitors", () => {
    const cronSettings = {
      heartbeatMode: "cron" as const,
      heartbeatCron: "*/15 * * * *",
      heartbeatGraceSec: 120,
      heartbeatTimezone: "America/New_York",
    };

    expect(
      normalizeMonitorConfig({
        ...monitorConfigDefaults(),
        ...cronSettings,
        kind: "push",
      }),
    ).toMatchObject({ ...cronSettings, assertions: [] });
    expect(
      normalizeMonitorConfig({
        ...monitorConfigDefaults(),
        ...cronSettings,
        kind: "http",
      }),
    ).toMatchObject({
      heartbeatMode: "interval",
      heartbeatCron: null,
      heartbeatGraceSec: null,
      heartbeatTimezone: null,
    });
  });
});

describe("monitor export schema", () => {
  const envelope = (
    monitors: MonitorExportInput["monitors"],
  ): MonitorExportInput => ({
    kind: "uptime-monitor-export",
    version: 1,
    exportedAt: "2026-05-01T12:00:00.000Z",
    monitors,
  });

  it("raises legacy intervals and drops destination ids", () => {
    expect(
      decode(
        MonitorExport,
        envelope([
          {
            name: "Legacy",
            kind: "http",
            target: "https://example.com",
            intervalSec: 30,
            notificationDestinationIds: ["foreign-destination"],
          },
        ]),
      ),
    ).toMatchObject({
      ok: true,
      value: {
        monitors: [{ intervalSec: 60, notificationDestinationIds: [] }],
      },
    });
  });

  it("keeps monitor validation such as cron schedules", () => {
    expect(
      decode(
        MonitorExport,
        envelope([
          {
            name: "Nightly job",
            kind: "push",
            heartbeatMode: "cron",
            heartbeatCron: "not a cron",
            heartbeatTimezone: "UTC",
          },
        ]),
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ message: m.validation_heartbeat_cron_invalid() }],
    });
  });
});

function savedMonitor(overrides: Partial<Monitor> = {}): Monitor {
  return {
    id: "monitor-1",
    name: "Monitor",
    kind: "http",
    target: "https://example.com",
    intervalSec: 60,
    timeoutMs: 10_000,
    retries: 0,
    assertions: [createStatusAssertion()],
    heartbeatMode: "interval",
    heartbeatCron: null,
    heartbeatGraceSec: null,
    heartbeatTimezone: null,
    notificationGraceSec: 0,
    pushToken: null,
    active: true,
    lastStatus: "unknown",
    lastCheckedAt: null,
    lastDurationMs: null,
    lastError: null,
    revision: 0,
    retryAt: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}
