import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { apiClient, parseResponse } from "@/lib/api-client";
import { monitorAssertionSchema } from "@/lib/monitor/assertions";
import { privateKey } from "@/lib/queries/keys";

export const monitorImportSchema = z.object({
  kind: z.literal("uptime-monitor-export"),
  version: z.literal(1),
  exportedAt: z.string(),
  monitors: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["http", "dns", "push"]),
      target: z.string().optional(),
      intervalSec: z.number().optional(),
      timeoutMs: z.number().optional(),
      retries: z.number().optional(),
      assertions: z.array(monitorAssertionSchema).optional(),
      heartbeatMode: z.enum(["interval", "cron"]).optional(),
      heartbeatCron: z.string().nullable().optional(),
      heartbeatGraceSec: z.number().nullable().optional(),
      heartbeatTimezone: z.string().nullable().optional(),
      notificationGraceSec: z.number().optional(),
      active: z.boolean().optional(),
    }),
  ),
});

export type MonitorImportPayload = z.infer<typeof monitorImportSchema>;

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
