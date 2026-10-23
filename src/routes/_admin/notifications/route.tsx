import { createFileRoute } from "@tanstack/react-router";

import { notificationsQueryOptions } from "@/lib/api/notifications";
import { NotificationsPage } from "@/routes/_admin/notifications/-components/notifications-page";
import { NotificationsSkeleton } from "@/routes/_admin/notifications/-components/notifications-skeleton";

export const Route = createFileRoute("/_admin/notifications")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(notificationsQueryOptions());
  },
  pendingComponent: NotificationsSkeleton,
  component: NotificationsPage,
});
