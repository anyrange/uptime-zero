import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";

export type IncidentFilters = {
  status?: "open" | "closed" | "all";
  monitor?: string;
  q?: string;
};

export const DASHBOARD_POLL_INTERVAL_MS = 60_000;

export function useDashboardQuery(pollingIntervalMs?: number) {
  return useQuery({
    queryKey: privateKey("dashboard"),
    queryFn: () => parseResponse(apiClient.dashboard.$get()),
    refetchInterval: pollingIntervalMs,
    refetchIntervalInBackground: false,
  });
}

export function useIncidentsQuery(filters: IncidentFilters) {
  return useQuery({
    queryKey: privateKey("incidents", filters),
    queryFn: () =>
      parseResponse(apiClient.dashboard.incidents.$get({ query: filters })),
  });
}

export function useRunChecksMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => parseResponse(apiClient.dashboard["run-checks"].$post()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("incidents"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
    },
  });
}
