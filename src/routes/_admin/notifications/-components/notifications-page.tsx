import type { ReactNode } from "react";

import { useState } from "react";

import type {
  NotificationDestinationListItem,
  NotificationProvider,
} from "@/types";

import { Error as ErrorState } from "@/components/error";
import {
  AppPage,
  AppPageHeader,
  AppPageHeaderContent,
  AppPageLabel,
  AppPageSubtitle,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { formatDateTime, notificationSummary } from "@/lib/formatters";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  providerLabel,
  useCreateNotificationMutation,
  useDeleteNotificationMutation,
  useNotificationsQuery,
  useTestNotificationMutation,
} from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import { CreateNotificationSheet } from "./create-notification-sheet";
import { EditNotificationSheet } from "./edit-notification-sheet";
import { NotificationProviderIcon } from "./notification-provider-icon";
import { NotificationsSkeleton } from "./notifications-skeleton";

const providerCards: Array<{
  provider: NotificationProvider;
  title: string;
  description: string;
}> = [
  {
    provider: "discord",
    title: m.notification_discord(),
    description: m.notification_discord_description(),
  },
  {
    provider: "webhook",
    title: m.notification_webhook(),
    description: m.notification_webhook_description(),
  },
  {
    provider: "telegram",
    title: m.notification_telegram(),
    description: m.notification_telegram_description(),
  },
];

export function NotificationsPage() {
  const notifications = useNotificationsQuery();
  const create = useCreateNotificationMutation();
  const remove = useDeleteNotificationMutation();
  const test = useTestNotificationMutation();
  const { check, isReady } = usePermissions();
  const canCreate = isReady && check("notification.create");
  const canUpdate = isReady && check("notification.update");
  const canDelete = isReady && check("notification.delete");
  const canTest = isReady && check("notification.test");

  const [createProvider, setCreateProvider] =
    useState<NotificationProvider | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const destinations =
    notifications.status === "success" ? notifications.data.destinations : [];
  const monitors =
    notifications.status === "success" ? notifications.data.monitors : [];
  const assignedCount = destinations.reduce(
    (count, destination) => count + destination.monitorCount,
    0,
  );

  return (
    <AppPage title={m.notification_title()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.notification_title()}</AppPageLabel>
          <AppPageSubtitle>{m.notification_description()}</AppPageSubtitle>
        </AppPageHeaderContent>
      </AppPageHeader>
      {notifications.status === "pending" ? <NotificationsSkeleton /> : null}
      {notifications.status === "error" ? (
        <ErrorState message={notifications.error.message} />
      ) : null}
      {notifications.status === "success" ? (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Card size="sm">
              <CardContent className="grid gap-1.5">
                <CardDescription>{m.notification_notifiers()}</CardDescription>
                <CardTitle>{destinations.length}</CardTitle>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="grid gap-1.5">
                <CardDescription>
                  {m.notification_assignments()}
                </CardDescription>
                <CardTitle>{assignedCount}</CardTitle>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="grid gap-1.5">
                <CardDescription>{m.monitor_monitors()}</CardDescription>
                <CardTitle>{monitors.length}</CardTitle>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="grid gap-1.5">
                <CardDescription>{m.notification_providers()}</CardDescription>
                <CardTitle>
                  {destinations.length > 0
                    ? new Set(destinations.map((item) => item.provider)).size
                    : 0}
                </CardTitle>
              </CardContent>
            </Card>
          </div>

          <div className="mt-2 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="grid content-start gap-4">
              <div className="grid gap-1">
                <h2 className="font-heading text-base font-medium">
                  {m.notification_configured()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {m.notification_configured_description()}
                </p>
              </div>
              <div className="grid gap-3">
                {destinations.length === 0 ? (
                  <Empty>{m.notification_none_configured()}</Empty>
                ) : (
                  destinations.map((destination) => (
                    <NotifierCard
                      destination={destination}
                      key={destination.id}
                      onDelete={
                        canDelete ? () => remove.mutate(destination.id) : null
                      }
                      onEdit={
                        canUpdate ? () => setEditingId(destination.id) : null
                      }
                      onTest={
                        canTest ? () => test.mutate(destination.id) : null
                      }
                      pending={
                        remove.isPending || test.isPending || create.isPending
                      }
                    />
                  ))
                )}
              </div>
            </section>

            {canCreate ? (
              <section className="grid content-start gap-4">
                <div className="grid gap-1">
                  <h2 className="font-heading text-base font-medium">
                    {m.notification_create_new()}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {m.notification_create_description()}
                  </p>
                </div>
                <div className="grid gap-3">
                  {providerCards.map((item) => (
                    <Card key={item.provider} size="sm">
                      <CardContent>
                        <div className="flex items-start gap-3">
                          <NotificationProviderIcon provider={item.provider} />
                          <div className="min-w-0 flex-1">
                            <CardTitle>{item.title}</CardTitle>
                            <CardDescription>
                              {item.description}
                            </CardDescription>
                          </div>
                          <Button
                            onClick={() => setCreateProvider(item.provider)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {m.common_add()}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {notifications.status === "success" ? (
        <>
          <CreateNotificationSheet
            monitors={monitors}
            onClose={() => setCreateProvider(null)}
            provider={createProvider}
          />
          <EditNotificationSheet
            editingId={editingId}
            monitors={monitors}
            onClose={() => setEditingId(null)}
          />
        </>
      ) : null}
    </AppPage>
  );
}

function NotifierCard({
  destination,
  onEdit,
  onDelete,
  onTest,
  pending,
}: {
  destination: NotificationDestinationListItem;
  onEdit: (() => void) | null;
  onDelete: (() => void) | null;
  onTest: (() => void) | null;
  pending: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start gap-4">
          <NotificationProviderIcon provider={destination.provider} />
          <div className="grid min-w-0 flex-1 gap-3">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle>{destination.name}</CardTitle>
                <CardDescription>
                  {providerLabel(destination.provider)}
                </CardDescription>
              </div>
              <Badge className="shrink-0" variant="outline">
                {m.notification_monitor_count({
                  count: destination.monitorCount,
                })}
              </Badge>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
              <Summary>
                <SummaryLabel>{m.notification_target()}</SummaryLabel>
                <SummaryValue>{notificationSummary(destination)}</SummaryValue>
              </Summary>
              <Summary>
                <SummaryLabel>{m.notification_updated()}</SummaryLabel>
                <SummaryValue>
                  {formatDateTime(destination.updatedAt)}
                </SummaryValue>
              </Summary>
              <Summary className="sm:col-span-2">
                <SummaryLabel>{m.notification_assigned()}</SummaryLabel>
                <SummaryValue>
                  {destination.assignedMonitors.length > 0
                    ? destination.assignedMonitors
                        .slice(0, 3)
                        .map((monitor) => monitor.name)
                        .join(", ")
                    : m.notification_no_monitors_assigned()}
                </SummaryValue>
              </Summary>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {onEdit ? (
                <Button
                  onClick={onEdit}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {m.common_edit()}
                </Button>
              ) : null}
              {onTest ? (
                <Button
                  disabled={pending}
                  onClick={onTest}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {m.notification_test()}
                </Button>
              ) : null}
              {onDelete ? (
                <Button
                  disabled={pending}
                  onClick={onDelete}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  {m.common_delete()}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Summary({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

function SummaryLabel({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function SummaryValue({ children }: { children: ReactNode }) {
  return <p className="font-medium break-words">{children}</p>;
}
