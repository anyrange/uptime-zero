import { Cron } from "croner";
import { z } from "zod";

import type {
  HeartbeatMode,
  MonitorAssertion,
  MonitorKind,
  MonitorRecord,
} from "@/types";

import { monitorAssertionSchema } from "@/lib/monitor-assertions";
import { m } from "@/paraglide/messages.js";

export type MonitorPayload = {
  name: string;
  kind: MonitorKind;
  target: string;
  intervalSec: number;
  timeoutMs: number;
  retries: number;
  assertions: MonitorAssertion[];
  heartbeatMode: HeartbeatMode;
  heartbeatCron: string | null;
  heartbeatGraceSec: number | null;
  heartbeatTimezone: string | null;
  notificationGraceSec: number;
  active: boolean;
  notificationDestinationIds: string[];
};

export const DEFAULT_HEARTBEAT_CRON = "0 * * * *";
export const DEFAULT_HEARTBEAT_GRACE_SEC = 300;
export const DEFAULT_HEARTBEAT_TIMEZONE = "UTC";
export const DEFAULT_NOTIFICATION_GRACE_SEC = 0;
export const MIN_MONITOR_INTERVAL_SEC = 60;

export const monitorConfigObjectSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(["http", "dns", "push"]),
  target: z.string().default(""),
  intervalSec: z.coerce
    .number()
    .int()
    .min(MIN_MONITOR_INTERVAL_SEC, {
      message: m.validation_interval_minimum(),
    })
    .default(MIN_MONITOR_INTERVAL_SEC),
  timeoutMs: z.coerce.number().int().min(1).default(10000),
  retries: z.coerce.number().int().min(0).default(0),
  assertions: z.array(monitorAssertionSchema).default([]),
  heartbeatMode: z.enum(["interval", "cron"]).default("interval"),
  heartbeatCron: z.string().trim().nullable().default(null),
  heartbeatGraceSec: z.coerce.number().int().min(1).nullable().default(null),
  heartbeatTimezone: z.string().trim().nullable().default(null),
  notificationGraceSec: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
  notificationDestinationIds: z.array(z.string()).default([]),
});

export const monitorConfigSchema = monitorConfigObjectSchema.superRefine(
  (value, ctx) => {
    if (value.kind !== "push" && !value.target.trim()) {
      ctx.addIssue({
        code: "custom",
        message: m.validation_target_required(),
        path: ["target"],
      });
    }

    if (
      value.kind === "dns" &&
      filterAssertionsForKind(value.kind, value.assertions).length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: m.validation_dns_assertion_required(),
        path: ["assertions"],
      });
    }

    if (value.kind === "push" && value.heartbeatMode === "cron") {
      if (!value.heartbeatCron?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: m.validation_heartbeat_cron_required(),
          path: ["heartbeatCron"],
        });
      }
      if (!value.heartbeatTimezone?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: m.validation_heartbeat_timezone_required(),
          path: ["heartbeatTimezone"],
        });
      }
      if (value.heartbeatCron?.trim() && !isValidCron(value.heartbeatCron)) {
        ctx.addIssue({
          code: "custom",
          message: m.validation_heartbeat_cron_invalid(),
          path: ["heartbeatCron"],
        });
      }
      if (
        value.heartbeatTimezone?.trim() &&
        !isValidTimezone(value.heartbeatTimezone)
      ) {
        ctx.addIssue({
          code: "custom",
          message: m.validation_heartbeat_timezone_invalid(),
          path: ["heartbeatTimezone"],
        });
      }
    }
  },
);

export type MonitorConfigInput = z.input<typeof monitorConfigObjectSchema>;
export type MonitorConfig = z.output<typeof monitorConfigObjectSchema>;

export function normalizeMonitorConfig(config: MonitorConfig): MonitorConfig {
  return {
    ...config,
    assertions: filterAssertionsForKind(config.kind, config.assertions),
    heartbeatMode: config.kind === "push" ? config.heartbeatMode : "interval",
    heartbeatCron:
      config.kind === "push" && config.heartbeatMode === "cron"
        ? config.heartbeatCron
        : null,
    heartbeatGraceSec:
      config.kind === "push" && config.heartbeatMode === "cron"
        ? config.heartbeatGraceSec
        : null,
    heartbeatTimezone:
      config.kind === "push" && config.heartbeatMode === "cron"
        ? config.heartbeatTimezone
        : null,
    notificationGraceSec: config.notificationGraceSec,
  };
}

export function parseMonitorConfigForStorage(config: MonitorConfig) {
  const monitor = normalizeMonitorConfig(config);
  return {
    name: monitor.name,
    kind: monitor.kind,
    target: monitor.target,
    intervalSec: monitor.intervalSec,
    timeoutMs: monitor.timeoutMs,
    retries: monitor.retries,
    assertions: monitor.assertions,
    heartbeatMode: monitor.heartbeatMode,
    heartbeatCron: monitor.heartbeatCron,
    heartbeatGraceSec: monitor.heartbeatGraceSec,
    heartbeatTimezone: monitor.heartbeatTimezone,
    notificationGraceSec: monitor.notificationGraceSec,
    active: monitor.active ? 1 : 0,
    notificationDestinationIds: monitor.notificationDestinationIds,
  };
}

export function getMonitorConfigDefaults(
  monitor?: MonitorRecord,
  notificationDestinationIds: string[] = [],
): MonitorPayload {
  return {
    name: monitor?.name ?? "",
    kind: monitor?.kind ?? "http",
    target: monitor?.target ?? "",
    intervalSec: monitor?.intervalSec ?? 60,
    timeoutMs: monitor?.timeoutMs ?? 10000,
    retries: monitor?.retries ?? 0,
    assertions: monitor?.assertions ?? [createStatusAssertion()],
    heartbeatMode: monitor?.heartbeatMode ?? "interval",
    heartbeatCron: monitor?.heartbeatCron ?? DEFAULT_HEARTBEAT_CRON,
    heartbeatGraceSec:
      monitor?.heartbeatGraceSec ?? DEFAULT_HEARTBEAT_GRACE_SEC,
    heartbeatTimezone: monitor?.heartbeatTimezone ?? DEFAULT_HEARTBEAT_TIMEZONE,
    notificationGraceSec:
      monitor?.notificationGraceSec ?? DEFAULT_NOTIFICATION_GRACE_SEC,
    active: monitor ? monitor.active === 1 : true,
    notificationDestinationIds,
  };
}

export function applyMonitorKindChange(
  state: Pick<MonitorPayload, "assertions" | "target">,
  nextKind: MonitorKind,
): Pick<MonitorPayload, "assertions" | "target"> {
  if (nextKind === "dns") {
    const assertions = state.assertions.filter(isDnsAssertion);
    return {
      assertions: assertions.length > 0 ? assertions : [createDnsAssertion()],
      target: state.target,
    };
  }

  if (nextKind === "http") {
    const assertions = state.assertions.filter(isHttpAssertion);
    return {
      assertions:
        assertions.length > 0 ? assertions : [createStatusAssertion()],
      target: state.target,
    };
  }

  return {
    assertions: [],
    target: "",
  };
}

export function createStatusAssertion(): MonitorAssertion {
  return {
    id: crypto.randomUUID(),
    type: "status",
    expected: 200,
  };
}

export function createHeaderAssertion(): MonitorAssertion {
  return {
    id: crypto.randomUUID(),
    type: "header",
    header: "content-type",
    operator: "contains",
    value: "application/json",
  };
}

export function createBodyTextAssertion(): MonitorAssertion {
  return {
    id: crypto.randomUUID(),
    type: "body",
    source: "text",
    operator: "contains",
    value: "",
  };
}

export function createBodyJsonAssertion(): MonitorAssertion {
  return {
    id: crypto.randomUUID(),
    type: "body",
    source: "json",
    path: "status",
    operator: "eq",
    value: "ok",
  };
}

export function createDnsAssertion(): MonitorAssertion {
  return {
    id: crypto.randomUUID(),
    type: "record",
    recordType: "A",
    operator: "contains",
    value: "",
  };
}

export function filterAssertionsForKind(
  kind: MonitorKind,
  assertions: MonitorAssertion[],
) {
  if (kind === "dns") {
    return assertions.filter(isDnsAssertion);
  }

  if (kind === "push") {
    return [];
  }

  return assertions.filter(isHttpAssertion);
}

function isDnsAssertion(assertion: MonitorAssertion) {
  return assertion.type === "record";
}

function isHttpAssertion(assertion: MonitorAssertion) {
  return assertion.type !== "record";
}

function isValidCron(expression: string) {
  try {
    new Cron(expression, { paused: true });
    return true;
  } catch {
    return false;
  }
}

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
