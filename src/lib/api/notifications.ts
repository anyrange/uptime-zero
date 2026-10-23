import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { privateKey } from "@/lib/api/keys";
import { permissionMiddleware } from "@/lib/api/middleware";
import {
  NotificationInput,
  type NotificationProvider,
} from "@/lib/schemas/notifications";
import * as notifications from "@/modules/notifications/notifications.service";
import { m } from "@/paraglide/messages.js";

const ById = z.object({ id: z.string() });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("notification.read")])
  .handler(() => notifications.list());

export const getNotification = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("notification.read")])
  .validator(ById)
  .handler(({ data }) => notifications.detail(data.id));

export const createNotification = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("notification.create")])
  .validator(NotificationInput)
  .handler(({ data }) => notifications.create(data));

export const updateNotification = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("notification.update")])
  .validator(z.object({ id: z.string(), input: NotificationInput }))
  .handler(({ data }) => notifications.update(data.id, data.input));

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("notification.delete")])
  .validator(ById)
  .handler(({ data }) => notifications.remove(data.id));

/** Sends a test event and surfaces delivery failures to the user. */
export const testNotification = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("notification.test")])
  .validator(ById)
  .handler(({ data }) => notifications.sendTest(data.id));

export function notificationsQueryOptions() {
  return queryOptions({
    queryKey: privateKey("notifications"),
    queryFn: () => listNotifications(),
  });
}

export function notificationQueryOptions(id: string) {
  return queryOptions({
    queryKey: privateKey("notifications", id),
    queryFn: () => getNotification({ data: { id } }),
  });
}

export function useCreateNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: z.input<typeof NotificationInput>) =>
      createNotification({ data: payload }),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient);
    },
  });
}

export function useUpdateNotificationMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: z.input<typeof NotificationInput>) =>
      updateNotification({ data: { id, input: payload } }),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, id);
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification({ data: { id } }),
    onSuccess: async (_, id) => {
      await invalidateNotificationQueries(queryClient, id);
    },
  });
}

export function useTestNotificationMutation() {
  return useMutation({
    mutationFn: (id: string) => testNotification({ data: { id } }),
  });
}

export function providerLabel(provider: NotificationProvider) {
  return provider === "discord"
    ? m.notification_discord()
    : provider === "telegram"
      ? m.notification_telegram()
      : m.notification_webhook();
}

async function invalidateNotificationQueries(
  queryClient: QueryClient,
  id?: string,
) {
  await queryClient.invalidateQueries({
    queryKey: privateKey("notifications"),
  });

  if (id) {
    await queryClient.invalidateQueries({
      queryKey: privateKey("notifications", id),
    });
  }

  await queryClient.invalidateQueries({ queryKey: privateKey("settings") });
  await queryClient.invalidateQueries({ queryKey: privateKey("monitors") });
  await queryClient.invalidateQueries({ queryKey: privateKey("dashboard") });
}
