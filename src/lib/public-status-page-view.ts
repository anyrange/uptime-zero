import type {
  StatusBarData,
  StatusReport,
  StatusType,
} from "@/components/blocks/status.types";
import type {
  IncidentRecord,
  MonitorRecord,
  PublicStatusPageData,
} from "@/types";

import { groupHeartbeats } from "@/lib/formatters";
import { formatUptimePercent } from "@/lib/formatters";
import {
  buildDailyStatusBarData,
  formatMonitorUptime,
  monitorStatusToBlockStatus,
} from "@/lib/status-blocks";
import { m } from "@/paraglide/messages.js";

export interface PublicStatusPageMonitorView {
  id: string;
  name: string;
  kind: MonitorRecord["kind"];
  status: Exclude<StatusType, "empty">;
  meta: string;
  uptime: string;
  history: StatusBarData[];
}

export interface PublicStatusPageMonitorGroup {
  title: string;
  status: Exclude<StatusType, "empty">;
  monitors: PublicStatusPageMonitorView[];
}

export interface PublicStatusPageIncidentView {
  id: string;
  title: string;
  body: string | null;
  badge: string;
  status: Exclude<StatusType, "empty">;
  openedAt: Date;
  closedAt: Date | null;
  monitorName: string;
  updates: StatusReport["updates"];
}

export interface PublicStatusPageUptimeWindow {
  label: string;
  uptime: string;
}

export interface PublicStatusPageViewModel {
  title: string;
  description: string | null;
  overallStatus: Exclude<StatusType, "empty">;
  showHistory: boolean;
  updatedAt: Date;
  uptimeWindows: PublicStatusPageUptimeWindow[];
  monitors: PublicStatusPageMonitorView[];
  monitorGroups: PublicStatusPageMonitorGroup[];
  incidents: PublicStatusPageIncidentView[];
  statusReports: StatusReport[];
}

export function buildPublicStatusPageView(
  data: PublicStatusPageData,
): PublicStatusPageViewModel {
  const historyDays = Number.isFinite(data.historyDays)
    ? Math.max(1, data.historyDays)
    : 30;
  const heartbeatMap = groupHeartbeats(data.heartbeats);
  const monitorMap = new Map(
    data.monitors.map((monitor) => [monitor.id, monitor]),
  );
  const monitors = data.monitors.map((monitor) => {
    const heartbeats = heartbeatMap.get(monitor.id) ?? [];

    return {
      id: monitor.id,
      name: monitor.name,
      kind: monitor.kind,
      status: monitorStatusToBlockStatus(monitor.lastStatus),
      meta:
        data.page.showTarget !== 1
          ? ""
          : monitor.kind === "push"
            ? m.status_page_push_monitor_meta()
            : monitor.target,
      uptime: formatMonitorUptime(heartbeats),
      history: buildDailyStatusBarData(
        heartbeats,
        data.incidents.filter((incident) => incident.monitorId === monitor.id),
        historyDays,
      ),
    };
  });

  return {
    title: data.page.title,
    description: data.page.description,
    overallStatus: monitorStatusToBlockStatus(data.status),
    showHistory: data.page.showHistory === 1,
    updatedAt: latestUpdatedAt(data),
    uptimeWindows: buildPublicUptimeWindows(data.heartbeats),
    monitors,
    monitorGroups: groupPublicMonitors(monitors),
    incidents: data.incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      body: incident.body,
      badge:
        incident.status === "open" ? m.incident_open() : m.common_resolved(),
      status: incident.status === "open" ? "error" : "success",
      openedAt: new Date(incident.openedAt),
      closedAt: incident.closedAt ? new Date(incident.closedAt) : null,
      monitorName:
        monitorMap.get(incident.monitorId)?.name ||
        m.status_block_monitor_fallback(),
      updates: toIncidentUpdates(incident),
    })),
    statusReports: data.incidents.map((incident, index) => ({
      id: index + 1,
      title: incident.title,
      affected: [
        monitorMap.get(incident.monitorId)?.name ||
          m.status_block_monitor_fallback(),
      ],
      updates: toIncidentUpdates(incident),
    })),
  };
}

function buildPublicUptimeWindows(
  heartbeats: PublicStatusPageData["heartbeats"],
): PublicStatusPageUptimeWindow[] {
  return [
    { days: 1, label: m.status_page_uptime_last_24_hours() },
    { days: 7, label: m.status_page_uptime_last_7_days() },
    { days: 30, label: m.status_page_uptime_last_30_days() },
    { days: 90, label: m.status_page_uptime_last_90_days() },
  ].map((window) => {
    const cutoff = Date.now() - window.days * 24 * 60 * 60 * 1000;
    const relevant = heartbeats.filter((heartbeat) => {
      const timestamp = new Date(heartbeat.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
    const upChecks = relevant.filter(
      (heartbeat) => heartbeat.status === "up",
    ).length;
    const uptime = relevant.length
      ? `${formatUptimePercent((upChecks / relevant.length) * 100)}%`
      : "-";

    return {
      label: window.label,
      uptime,
    };
  });
}

function groupPublicMonitors(
  monitors: PublicStatusPageMonitorView[],
): PublicStatusPageMonitorGroup[] {
  const labels = {
    http: m.status_block_http_monitors(),
    dns: m.status_block_dns_monitors(),
    push: m.status_block_push_monitors(),
  } satisfies Record<MonitorRecord["kind"], string>;

  const grouped = new Map<
    MonitorRecord["kind"],
    PublicStatusPageMonitorView[]
  >();
  for (const monitor of monitors) {
    const bucket = monitor.kind;
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), monitor]);
  }

  return Array.from(grouped.entries()).map(([bucket, items]) => ({
    title: labels[bucket] ?? m.monitor_monitors(),
    status: aggregateBlockStatus(items.map((item) => item.status)),
    monitors: items,
  }));
}

function aggregateBlockStatus(
  statuses: Exclude<StatusType, "empty">[],
): Exclude<StatusType, "empty"> {
  if (statuses.includes("error")) {
    return "error";
  }
  if (statuses.includes("degraded")) {
    return "degraded";
  }
  if (statuses.includes("info")) {
    return "info";
  }
  return "success";
}

function toIncidentUpdates(incident: IncidentRecord): StatusReport["updates"] {
  const updates: StatusReport["updates"] = [
    {
      date: new Date(incident.openedAt),
      message: incident.body ?? m.status_block_incident_opened_message(),
      status: "investigating",
    },
  ];

  if (incident.closedAt) {
    updates.unshift({
      date: new Date(incident.closedAt),
      message: m.status_block_incident_resolved_message(),
      status: "resolved",
    });
  }

  return updates;
}

function latestUpdatedAt(data: PublicStatusPageData) {
  const timestamps = [
    data.page.updatedAt,
    ...data.monitors.map((monitor) => monitor.updatedAt),
    ...data.incidents.map((incident) => incident.openedAt),
  ]
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  return new Date(Math.max(...timestamps));
}
