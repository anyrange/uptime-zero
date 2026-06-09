import type { MonitorAssertion, MonitorRecord } from "@/types";

import {
  applyMonitorKindChange,
  createBodyJsonAssertion,
  createBodyTextAssertion,
  createDnsAssertion,
  createHeaderAssertion,
  createStatusAssertion,
  getMonitorConfigDefaults,
  monitorConfigSchema,
  normalizeMonitorConfig,
  type MonitorPayload,
} from "@/lib/monitor-config";
import { m } from "@/paraglide/messages.js";

export type MonitorConfigFormState = MonitorPayload;

export type MonitorConfigFormResult =
  | { ok: true; payload: MonitorPayload }
  | { ok: false; error: string };

export function getMonitorConfigFormDefaults(
  monitor?: MonitorRecord,
  notificationDestinationIds: string[] = [],
): MonitorConfigFormState {
  return getMonitorConfigDefaults(monitor, notificationDestinationIds);
}

export function addMonitorAssertion(
  assertions: MonitorAssertion[],
  assertion: MonitorAssertion,
) {
  return [...assertions, assertion];
}

export function updateMonitorAssertion(
  assertions: MonitorAssertion[],
  assertion: MonitorAssertion,
) {
  return assertions.map((item) =>
    item.id === assertion.id ? assertion : item,
  );
}

export function removeMonitorAssertion(
  assertions: MonitorAssertion[],
  assertionId: string,
) {
  return assertions.filter((item) => item.id !== assertionId);
}

export function validateMonitorConfigForm(
  state: MonitorConfigFormState,
): MonitorConfigFormResult {
  const parsed = monitorConfigSchema.safeParse(state);
  if (!parsed.success) {
    return {
      ok: false,
      error: formatMonitorConfigFormError(parsed.error),
    };
  }

  return { ok: true, payload: normalizeMonitorConfig(parsed.data) };
}

function formatMonitorConfigFormError(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const issue = error.issues[0];
  const field = issue?.path[0];

  if (field === "name") {
    return m.validation_name_required();
  }
  if (field === "intervalSec") {
    return m.validation_interval_positive();
  }
  if (field === "timeoutMs") {
    return m.validation_timeout_positive();
  }
  if (field === "retries") {
    return m.validation_retries_nonnegative();
  }
  if (
    field === "heartbeatCron" ||
    field === "heartbeatGraceSec" ||
    field === "heartbeatTimezone"
  ) {
    return issue?.message ?? m.validation_heartbeat_schedule();
  }
  if (field === "notificationGraceSec") {
    return issue?.message ?? m.validation_notification_grace();
  }

  return issue?.message ?? m.validation_monitor_payload();
}

export {
  applyMonitorKindChange,
  createBodyJsonAssertion,
  createBodyTextAssertion,
  createDnsAssertion,
  createHeaderAssertion,
  createStatusAssertion,
};
