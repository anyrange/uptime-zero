import "@tanstack/react-start/server-only";
import type { IncidentFilters } from "@/lib/schemas/incidents";

import * as repo from "./incidents.repository";

/** Incident use cases. Incidents open and close as checks are recorded. */

const RECENT_LIMIT = 12;

const MONITOR_HISTORY_LIMIT = 50;

export function search(filters: IncidentFilters) {
  return repo.search({
    status: filters.status ?? "all",
    monitorId: filters.monitor || undefined,
    text: filters.q || undefined,
  });
}

export function recent() {
  return repo.listRecent(RECENT_LIMIT);
}

export const countOpen = repo.countOpen;

export function forMonitor(monitorId: string) {
  return repo.listForMonitors([monitorId], MONITOR_HISTORY_LIMIT);
}

export const forMonitors = repo.listForMonitors;
