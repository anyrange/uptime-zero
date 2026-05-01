import { z } from "zod";

import type { MonitorAssertion, MonitorKind, MonitorRecord } from "@/types";

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
  active: boolean;
  notificationDestinationIds: string[];
};

export const monitorConfigObjectSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(["http", "dns", "push"]),
  target: z.string().default(""),
  intervalSec: z.coerce.number().int().min(1).default(60),
  timeoutMs: z.coerce.number().int().min(1).default(10000),
  retries: z.coerce.number().int().min(0).default(0),
  assertions: z.array(monitorAssertionSchema).default([]),
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
  },
);

export type MonitorConfigInput = z.input<typeof monitorConfigObjectSchema>;
export type MonitorConfig = z.output<typeof monitorConfigObjectSchema>;

export function normalizeMonitorConfig(config: MonitorConfig): MonitorConfig {
  return {
    ...config,
    assertions: filterAssertionsForKind(config.kind, config.assertions),
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
