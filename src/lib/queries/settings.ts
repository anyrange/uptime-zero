import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MonitorAssertion } from "@/types";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";

export type MonitorImportPayload = {
  kind: "uptime-monitor-export";
  version: 1;
  exportedAt: string;
  monitors: Array<{
    name: string;
    kind: "http" | "dns" | "push";
    target?: string;
    intervalSec?: number;
    timeoutMs?: number;
    retries?: number;
    assertions?: MonitorAssertion[];
    sslExpiryWarnDays?: number | null;
    sslExpiryFailDays?: number | null;
    heartbeatMode?: "interval" | "cron";
    heartbeatCron?: string | null;
    heartbeatGraceSec?: number | null;
    heartbeatTimezone?: string | null;
    active?: boolean;
  }>;
};

export function useSettingsQuery() {
  return useQuery({
    queryKey: privateKey("settings"),
    queryFn: () => parseResponse(apiClient.settings.$get()),
  });
}

export function useUpdateRetentionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      heartbeatRetentionDays: number;
      incidentRetentionDays: number;
    }) => parseResponse(apiClient.settings.retention.$put({ json: payload })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
    },
  });
}

export function useExportMonitorsMutation() {
  return useMutation({
    mutationFn: () => parseResponse(apiClient.settings.monitors.export.$get()),
  });
}

export function useImportMonitorsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MonitorImportPayload) =>
      parseResponse(
        apiClient.settings.monitors.import.$post({ json: payload }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
    },
  });
}
