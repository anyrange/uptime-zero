import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  MonitorConfigInput,
  MonitorExportInput,
} from "@/lib/schemas/monitor-config";

import { privateKey } from "@/lib/api/keys";
import { permissionMiddleware } from "@/lib/api/middleware";
import { MonitorConfig, MonitorExport } from "@/lib/schemas/monitor-config";
import * as monitors from "@/modules/monitors/monitors.service";
import * as notifications from "@/modules/notifications/notifications.service";

const ById = z.object({ id: z.string() });

export const listMonitors = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("monitor.read")])
  .handler(() => monitors.list());

export const getMonitor = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("monitor.read")])
  .validator(ById)
  .handler(({ data }) => monitors.detail(data.id));

export type MonitorDetail = Awaited<ReturnType<typeof getMonitor>>;

/** Lightweight polling read for the live status in the monitor header. */
export const getMonitorState = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("monitor.read")])
  .validator(ById)
  .handler(({ data }) => monitors.get(data.id));

export const getMonitorLogs = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("monitor.read")])
  .validator(z.object({ id: z.string(), page: z.int() }))
  .handler(({ data }) => monitors.logs(data.id, data.page));

export type MonitorLogs = Awaited<ReturnType<typeof getMonitorLogs>>;

export const createMonitor = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.create")])
  .validator(MonitorConfig)
  .handler(async ({ data }) => {
    const monitor = await monitors.create(data);

    // The first check may have opened an incident; alert without waiting
    // for the next cron run.
    notifications.deliverDueAfterResponse();

    return monitor;
  });

/** Probes an unsaved configuration without persisting anything. */
export const testMonitor = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.create")])
  .validator(MonitorConfig)
  .handler(({ data }) => monitors.test(data));

export const updateMonitor = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.update")])
  .validator(z.object({ id: z.string(), config: MonitorConfig }))
  .handler(({ data }) => monitors.update(data.id, data.config));

export const deleteMonitors = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.delete")])
  .validator(z.object({ ids: z.array(z.string()).min(1) }))
  .handler(({ data }) => monitors.remove(data.ids));

export const rotatePushToken = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.update")])
  .validator(ById)
  .handler(({ data }) => monitors.rotatePushToken(data.id));

export const pauseMonitor = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.pause")])
  .validator(ById)
  .handler(({ data }) => monitors.setActive(data.id, false));

export const resumeMonitor = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.resume")])
  .validator(ById)
  .handler(({ data }) => monitors.setActive(data.id, true));

/** Configuration only: ids, tokens and runtime state stay on this install. */
export const exportMonitors = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("monitor.export")])
  .handler(() => monitors.exportConfig());

export const importMonitors = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("monitor.import")])
  .validator(MonitorExport)
  .handler(async ({ data }) => {
    const saved = await monitors.importConfig(data);

    return { imported: saved.length, monitors: saved };
  });

export const MONITOR_LIST_POLL_INTERVAL_MS = 30_000;

export function monitorListQueryOptions() {
  return queryOptions({
    queryKey: privateKey("monitors"),
    queryFn: () => listMonitors(),
    refetchInterval: MONITOR_LIST_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function monitorQueryOptions(id: string) {
  return queryOptions({
    queryKey: privateKey("monitors", id),
    queryFn: () => getMonitor({ data: { id } }),
  });
}

export function monitorStateQueryOptions(id: string) {
  return queryOptions({
    queryKey: privateKey("monitors", id, "state"),
    queryFn: () => getMonitorState({ data: { id } }),
    refetchInterval: MONITOR_LIST_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function monitorLogsQueryOptions(id: string, page: number) {
  return queryOptions({
    queryKey: privateKey("monitors", id, "logs", page),
    queryFn: () => getMonitorLogs({ data: { id, page } }),
  });
}

export function useCreateMonitorMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MonitorConfigInput) =>
      createMonitor({ data: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
    },
  });
}

export function useTestMonitorMutation() {
  return useMutation({
    mutationFn: (payload: MonitorConfigInput) => testMonitor({ data: payload }),
  });
}

export function useUpdateMonitorMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MonitorConfigInput) =>
      updateMonitor({ data: { id, config: payload } }),
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
    mutationFn: () => deleteMonitors({ data: { ids: [id] } }),
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
    mutationFn: (ids: ReadonlyArray<string>) =>
      deleteMonitors({ data: { ids: [...ids] } }),
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

export function usePauseMonitorMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pauseMonitor({ data: { id } }),
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
    mutationFn: () => resumeMonitor({ data: { id } }),
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

export function useRotatePushTokenMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => rotatePushToken({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
    },
  });
}

export function useExportMonitorsMutation() {
  return useMutation({
    mutationFn: () => exportMonitors(),
  });
}

/** Takes the file as parsed JSON; the server decodes it again. */
export function useImportMonitorsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MonitorExportInput) =>
      importMonitors({ data: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
      await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
    },
  });
}
