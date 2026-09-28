import { queryOptions } from "@tanstack/react-query";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";

export type IncidentFilters = {
  status?: "open" | "closed" | "all";
  monitor?: string;
  q?: string;
};

export const DASHBOARD_POLL_INTERVAL_MS = 30_000;

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: privateKey("dashboard"),
    queryFn: () => parseResponse(apiClient.dashboard.$get()),
    refetchInterval: DASHBOARD_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function incidentsQueryOptions(filters: IncidentFilters) {
  return queryOptions({
    queryKey: privateKey("incidents", filters),
    queryFn: () =>
      parseResponse(apiClient.dashboard.incidents.$get({ query: filters })),
  });
}
