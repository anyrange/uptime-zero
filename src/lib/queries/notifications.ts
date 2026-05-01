import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { NotificationProvider } from "@/types";

import { apiClient, parseResponse } from "@/lib/api-client";
import { privateKey } from "@/lib/queries/keys";
import { m } from "@/paraglide/messages.js";

export type NotificationPayload =
  | {
      name: string;
      provider: "discord";
      webhookUrl: string;
      monitorIds: string[];
    }
  | {
      name: string;
      provider: "webhook";
      url: string;
      headers: Array<{ key: string; value: string }>;
      monitorIds: string[];
    }
  | {
      name: string;
      provider: "telegram";
      botToken: string;
      chatId: string;
      messageThreadId: string | null;
      monitorIds: string[];
    };

export function useNotificationsQuery() {
  return useQuery({
    queryKey: privateKey("notifications"),
    queryFn: () => parseResponse(apiClient.notifications.$get()),
  });
}

export function useNotificationQuery(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: privateKey("notifications", id ?? "new"),
    queryFn: () =>
      parseResponse(
        apiClient.notifications[":id"].$get({ param: { id: id ?? "" } }),
      ),
  });
}

export function useCreateNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: NotificationPayload) =>
      parseResponse(apiClient.notifications.$post({ json: payload })),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient);
    },
  });
}

export function useUpdateNotificationMutation(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: NotificationPayload) =>
      parseResponse(
        apiClient.notifications[":id"].$put({ param: { id }, json: payload }),
      ),
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, id);
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      parseResponse(apiClient.notifications[":id"].$delete({ param: { id } })),
    onSuccess: async (_, id) => {
      await invalidateNotificationQueries(queryClient, id);
    },
  });
}

export function useTestNotificationMutation() {
  return useMutation({
    mutationFn: (id: string) =>
      parseResponse(
        apiClient.notifications[":id"].test.$post({ param: { id } }),
      ),
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
