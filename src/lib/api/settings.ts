import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { privateKey } from "@/lib/api/keys";
import { permissionMiddleware } from "@/lib/api/middleware";
import { RetentionSettings } from "@/lib/schemas/settings";
import * as incidents from "@/modules/incidents/incidents.service";
import * as monitors from "@/modules/monitors/monitors.service";
import * as notifications from "@/modules/notifications/notifications.service";
import * as settings from "@/modules/settings/settings.service";
import * as statusPages from "@/modules/status-pages/status-pages.service";

/** Settings plus the workspace inventory the settings screens summarize. */
export const getSettings = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("settings.read")])
  .handler(async () => {
    const [
      current,
      allMonitors,
      openIncidentCount,
      pages,
      statusPageLinks,
      notificationDestinations,
    ] = await Promise.all([
      settings.current(),
      monitors.all(),
      incidents.countOpen(),
      statusPages.list(),
      statusPages.links(),
      notifications.destinations(),
    ]);

    return {
      settings: current,
      monitors: allMonitors,
      openIncidentCount,
      statusPages: pages,
      statusPageLinks,
      notificationDestinations,
    };
  });

export type SettingsOverview = Awaited<ReturnType<typeof getSettings>>;

export const updateRetention = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("settings.updateRetention")])
  .validator(RetentionSettings)
  .handler(({ data }) => settings.updateRetention(data));

export function settingsQueryOptions() {
  return queryOptions({
    queryKey: privateKey("settings"),
    queryFn: () => getSettings(),
  });
}

export function useUpdateRetentionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RetentionSettings) =>
      updateRetention({ data: payload }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
      await queryClient.invalidateQueries({
        queryKey: privateKey("dashboard"),
      });
    },
  });
}
