import { Cron } from "croner";
import { z } from "zod";

import { m } from "@/paraglide/messages.js";

import {
  HeartbeatMode,
  type Monitor,
  MonitorAssertion,
  MonitorKind,
} from "./monitors";

/**
 * What a user configures about a monitor. One schema validates the monitor
 * form in the browser, the create/update/test server functions, and every
 * monitor inside an import file.
 */

export const DEFAULT_HEARTBEAT_CRON = "0 * * * *";

export const DEFAULT_HEARTBEAT_GRACE_SEC = 300;

export const DEFAULT_HEARTBEAT_TIMEZONE = "UTC";

export const DEFAULT_NOTIFICATION_GRACE_SEC = 0;

export const MIN_MONITOR_INTERVAL_SEC = 60;

export const MAX_MONITOR_TIMEOUT_MS = 30_000;

export const MAX_MONITOR_RETRIES = 1;

export const MAX_MONITOR_NOTIFICATION_DESTINATIONS = 8;

const notificationGraceSec = z
  .int()
  .min(0, { error: () => m.validation_notification_grace() })
  .default(DEFAULT_NOTIFICATION_GRACE_SEC);

const monitorConfigFields = {
  name: z
    .string()
    .trim()
    .min(1, { error: () => m.validation_name_required() }),
  kind: MonitorKind,
  target: z.string().default(""),
  intervalSec: z
    .int()
    .min(MIN_MONITOR_INTERVAL_SEC, {
      error: () => m.validation_interval_minimum(),
    })
    .default(MIN_MONITOR_INTERVAL_SEC),
  timeoutMs: z
    .int()
    .min(1, { error: () => m.validation_timeout_positive() })
    .max(MAX_MONITOR_TIMEOUT_MS, {
      error: () => m.validation_timeout_maximum(),
    })
    .default(10_000),
  retries: z
    .int()
    .min(0, { error: () => m.validation_retries_nonnegative() })
    .max(MAX_MONITOR_RETRIES, { error: () => m.validation_retries_maximum() })
    .default(0),
  assertions: z.array(MonitorAssertion).default([]),
  heartbeatMode: HeartbeatMode.default("interval"),
  heartbeatCron: z.string().trim().nullable().default(null),
  heartbeatGraceSec: z
    .int()
    .min(1, { error: () => m.validation_heartbeat_grace_positive() })
    .nullable()
    .default(null),
  heartbeatTimezone: z.string().trim().nullable().default(null),
  notificationGraceSec,
  active: z.boolean().default(true),
  notificationDestinationIds: z
    .array(z.string())
    .max(MAX_MONITOR_NOTIFICATION_DESTINATIONS, {
      error: () => m.validation_notification_destinations_maximum(),
    })
    .default([]),
};

/** Cross-field rules; zod only runs them once each field is valid. */
function checkMonitorConfigRules(
  config: {
    readonly kind: MonitorKind;
    readonly target: string;
    readonly assertions: ReadonlyArray<MonitorAssertion>;
    readonly heartbeatMode: HeartbeatMode;
    readonly heartbeatCron: string | null;
    readonly heartbeatTimezone: string | null;
  },
  ctx: z.RefinementCtx,
) {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });

  if (config.kind !== "push" && !config.target.trim()) {
    issue("target", m.validation_target_required());
  }

  if (
    config.kind === "dns" &&
    assertionsForKind("dns", config.assertions).length === 0
  ) {
    issue("assertions", m.validation_dns_assertion_required());
  }

  if (config.kind === "push" && config.heartbeatMode === "cron") {
    if (!config.heartbeatCron) {
      issue("heartbeatCron", m.validation_heartbeat_cron_required());
    } else if (!isValidCron(config.heartbeatCron)) {
      issue("heartbeatCron", m.validation_heartbeat_cron_invalid());
    }

    if (!config.heartbeatTimezone) {
      issue("heartbeatTimezone", m.validation_heartbeat_timezone_required());
    } else if (!isValidTimezone(config.heartbeatTimezone)) {
      issue("heartbeatTimezone", m.validation_heartbeat_timezone_invalid());
    }
  }
}

export const MonitorConfig = z
  .object(monitorConfigFields)
  .superRefine(checkMonitorConfigRules);

/** The parsed configuration; also the monitor form's state. */
export type MonitorConfig = z.output<typeof MonitorConfig>;

/** What clients may send; every field with a default is optional. */
export type MonitorConfigInput = z.input<typeof MonitorConfig>;

/**
 * The export file format. Monitors carry configuration only: destinations
 * belong to the exporting installation and are dropped, and intervals below
 * today's minimum (allowed by older exports) are raised instead of rejected.
 */
export const MonitorExport = z.object({
  kind: z.literal("uptime-monitor-export"),
  version: z.literal(1),
  exportedAt: z.string(),
  monitors: z
    .array(
      z
        .object({
          ...monitorConfigFields,
          intervalSec: z
            .int()
            .min(1)
            .default(MIN_MONITOR_INTERVAL_SEC)
            .transform((value) => Math.max(value, MIN_MONITOR_INTERVAL_SEC)),
          notificationDestinationIds: z
            .array(z.string())
            .default([])
            .transform((): string[] => []),
        })
        .superRefine(checkMonitorConfigRules),
    )
    .min(1)
    .max(100),
});

export type MonitorExport = z.output<typeof MonitorExport>;

/** An export file as uploaded; the server parses it again. */
export type MonitorExportInput = z.input<typeof MonitorExport>;

/**
 * Drops settings that don't apply to the monitor's kind, so a monitor never
 * stores HTTP assertions on a heartbeat or a cron schedule on a poll check.
 */
export function normalizeMonitorConfig(config: MonitorConfig): MonitorConfig {
  const cron = config.kind === "push" && config.heartbeatMode === "cron";

  return {
    ...config,
    assertions: assertionsForKind(config.kind, config.assertions),
    heartbeatMode: config.kind === "push" ? config.heartbeatMode : "interval",
    heartbeatCron: cron ? config.heartbeatCron : null,
    heartbeatGraceSec: cron ? config.heartbeatGraceSec : null,
    heartbeatTimezone: cron ? config.heartbeatTimezone : null,
  };
}

/** Form defaults for a new monitor, or the saved configuration of `monitor`. */
export function monitorConfigDefaults(
  monitor?: Monitor,
  notificationDestinationIds: ReadonlyArray<string> = [],
): MonitorConfig {
  return {
    name: monitor?.name ?? "",
    kind: monitor?.kind ?? "http",
    target: monitor?.target ?? "",
    intervalSec: monitor?.intervalSec ?? MIN_MONITOR_INTERVAL_SEC,
    timeoutMs: monitor?.timeoutMs ?? 10_000,
    retries: monitor?.retries ?? 0,
    assertions: monitor?.assertions ?? [createStatusAssertion()],
    heartbeatMode: monitor?.heartbeatMode ?? "interval",
    heartbeatCron: monitor?.heartbeatCron ?? DEFAULT_HEARTBEAT_CRON,
    heartbeatGraceSec:
      monitor?.heartbeatGraceSec ?? DEFAULT_HEARTBEAT_GRACE_SEC,
    heartbeatTimezone: monitor?.heartbeatTimezone ?? DEFAULT_HEARTBEAT_TIMEZONE,
    notificationGraceSec:
      monitor?.notificationGraceSec ?? DEFAULT_NOTIFICATION_GRACE_SEC,
    active: monitor?.active ?? true,
    notificationDestinationIds: [...notificationDestinationIds],
  };
}

/** Keeps compatible assertions when the kind changes, or seeds a default. */
export function applyMonitorKindChange(
  state: {
    readonly assertions: ReadonlyArray<MonitorAssertion>;
    readonly target: string;
  },
  nextKind: MonitorKind,
): Pick<MonitorConfig, "assertions" | "target"> {
  if (nextKind === "push") return { assertions: [], target: "" };

  const kept = assertionsForKind(nextKind, state.assertions);

  return {
    assertions:
      kept.length > 0
        ? kept
        : [nextKind === "dns" ? createDnsAssertion() : createStatusAssertion()],
    target: state.target,
  };
}

export function assertionsForKind(
  kind: MonitorKind,
  assertions: ReadonlyArray<MonitorAssertion>,
) {
  if (kind === "push") return [];

  return assertions.filter((assertion) =>
    kind === "dns" ? assertion.type === "record" : assertion.type !== "record",
  );
}

export function createStatusAssertion(): MonitorAssertion {
  return { id: crypto.randomUUID(), type: "status", expected: 200 };
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
