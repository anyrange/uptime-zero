import { createFileRoute } from "@tanstack/react-router";

import { notificationsQueryOptions } from "@/lib/queries/notifications";

import { NotificationsPage } from "./-components/notifications-page";
import { NotificationsSkeleton } from "./-components/notifications-skeleton";

export const Route = createFileRoute("/_admin/notifications")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(notificationsQueryOptions());
  },
  pendingComponent: NotificationsSkeleton,
  component: NotificationsPage,
});
