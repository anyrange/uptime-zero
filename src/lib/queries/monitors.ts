import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MonitorPayload } from "@/lib/monitor-config";
import type { HeartbeatPage } from "@/types";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";

export type { MonitorPayload } from "@/lib/monitor-config";

export const MONITOR_LIST_POLL_INTERVAL_MS = 10_000;

export function useMonitorListQuery(pollingIntervalMs?: number) {
  return useQuery({
    queryKey: privateKey("monitors"),
    queryFn: () => parseResponse(apiClient.monitors.$get()),
    refetchInterval: pollingIntervalMs,
  });
}

export function useMonitorQuery(id: string) {
  return useQuery({
    queryKey: privateKey("monitors", id),
    queryFn: () =>
      parseResponse(apiClient.monitors[":id"].$get({ param: { id } })),
  });
}

export function useMonitorLogsQuery(id: string, page: number) {
  return useQuery({
    queryKey: privateKey("monitors", id, "logs", page),
    queryFn: () =>
      parseResponse(
        apiClient.monitors[":id"].logs.$get({
          param: { id },
          query: { page: String(page) },
        }),
      ) as Promise<HeartbeatPage>,
  });
}

export function useCreateMonitorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MonitorPayload) =>
      parseResponse(apiClient.monitors.$post({ json: payload })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
    },
  });
}

export function useUpdateMonitorMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MonitorPayload) =>
      parseResponse(
        apiClient.monitors[":id"].$put({ param: { id }, json: payload }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("incidents"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
      await queryClient.invalidateQueries({
        queryKey: privateKey("monitors", id),
      });
    },
  });
}

export function useDeleteMonitorMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      parseResponse(apiClient.monitors[":id"].$delete({ param: { id } })),
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

export function useDeleteMonitorsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(
        ids.map((id) =>
          parseResponse(apiClient.monitors[":id"].$delete({ param: { id } })),
        ),
      ),
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

export function useRunMonitorMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      parseResponse(apiClient.monitors[":id"].run.$post({ param: { id } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("incidents"),
      });
      await queryClient.invalidateQueries({
        queryKey: privateKey("monitors", id),
      });
    },
  });
}

export function usePauseMonitorMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      parseResponse(apiClient.monitors[":id"].pause.$post({ param: { id } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
      await queryClient.invalidateQueries({
        queryKey: privateKey("monitors", id),
      });
    },
  });
}

export function useResumeMonitorMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      parseResponse(apiClient.monitors[":id"].resume.$post({ param: { id } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
      await queryClient.invalidateQueries({
        queryKey: privateKey("monitors", id),
      });
    },
  });
}
