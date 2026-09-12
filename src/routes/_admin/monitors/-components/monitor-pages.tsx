import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import { Error } from "@/components/error";
import {
  AppPage,
  AppPageActions,
  AppPageHeader,
  AppPageHeaderContent,
  AppPageLabel,
  AppPageSubtitle,
} from "@/components/page";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import {
  useCreateMonitorMutation,
  useDeleteMonitorMutation,
  useMonitorListQuery,
  useMonitorLogsQuery,
  useMonitorQuery,
  useTestMonitorMutation,
  useUpdateMonitorMutation,
} from "@/lib/queries/monitors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { MonitorIncidentsTable } from "../-components/monitor-incidents-table";
import { MonitorLogsTable } from "../-components/monitor-logs-table";
import { MonitorWorkspacePage } from "../-components/monitor-workspace-page";
import { MonitorsIndexContent } from "../-components/monitors-index-content";
import {
  MonitorFormSkeleton,
  MonitorsSkeleton,
} from "../-components/monitors-skeleton";
import { MonitorForm } from "./monitor-form";

export function NewMonitorPage() {
  const data = useMonitorListQuery();
  const create = useCreateMonitorMutation();
  const test = useTestMonitorMutation();
  const navigate = useNavigate();

  return (
    <AppPage title={m.monitor_configuration()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.monitor_configuration()}</AppPageLabel>
          <AppPageSubtitle>
            {m.monitor_configuration_description()}
          </AppPageSubtitle>
        </AppPageHeaderContent>
        <AppPageActions>
          <Button asChild variant="outline">
            <Link to="/monitors">{m.common_back()}</Link>
          </Button>
        </AppPageActions>
      </AppPageHeader>
      {data.status === "pending" ? <MonitorFormSkeleton /> : null}
      {data.status === "error" ? <Error message={data.error.message} /> : null}
      {data.status === "success" ? (
        <MonitorConfigLayout>
          <MonitorForm
            destinations={data.data.notificationDestinations}
            onSubmit={async (payload) => {
              await create.mutateAsync(payload);
              await navigate({ to: "/monitors" });
            }}
            onTest={async (payload) => {
              try {
                const result = await test.mutateAsync(payload);

                if (result.status === "up") {
                  toast.success(m.monitor_test_success(), {
                    description: m.monitor_test_success_description({
                      duration: result.durationMs,
                    }),
                  });

                  return;
                }

                toast.error(m.monitor_test_failed(), {
                  description:
                    result.error ?? m.monitor_test_failed_description(),
                });
              } catch (error) {
                toast.error(m.monitor_test_failed(), {
                  description:
                    error instanceof globalThis.Error
                      ? error.message
                      : m.monitor_test_failed_description(),
                });
              }
            }}
            pending={create.isPending}
            testPending={test.isPending}
          />
        </MonitorConfigLayout>
      ) : null}
    </AppPage>
  );
}

export function MonitorsIndexPage() {
  const data = useMonitorListQuery();

  return (
    <AppPage title={m.monitor_monitors()}>
      <AppPageHeader>
        <AppPageHeaderContent>
          <AppPageLabel>{m.monitor_monitors()}</AppPageLabel>
          <AppPageSubtitle>{m.monitor_description()}</AppPageSubtitle>
        </AppPageHeaderContent>
        <AppPageActions>
          <Button asChild variant="outline">
            <Link to="/monitors/new">{m.monitor_new()}</Link>
          </Button>
        </AppPageActions>
      </AppPageHeader>
      {data.status === "pending" ? <MonitorsSkeleton /> : null}
      {data.status === "error" ? <Error message={data.error.message} /> : null}
      {data.status === "success" ? (
        <MonitorsIndexContent
          monitors={data.data.monitors}
          slowestP95ResponseMs={data.data.slowestP95ResponseMs}
        />
      ) : null}
    </AppPage>
  );
}

export function MonitorLogsPage({
  monitorId,
  page,
}: {
  monitorId: string;
  page: number;
}) {
  const detail = useMonitorQuery(monitorId);
  const logs = useMonitorLogsQuery(monitorId, page);
  const navigate = useNavigate();

  useEffect(() => {
    if (logs.status !== "success" || logs.data.page === page) {
      return;
    }

    void navigate({
      to: "/monitors/$monitorId/logs",
      params: { monitorId },
      search: { page: logs.data.page },
      replace: true,
    });
  }, [logs.data, logs.status, monitorId, navigate, page]);

  return (
    <MonitorWorkspacePage currentTab="logs" detail={detail}>
      {() =>
        logs.status === "pending" ? (
          <MonitorsSkeleton />
        ) : logs.status === "error" ? (
          <Error message={logs.error.message} />
        ) : logs.data.total === 0 ? (
          <Empty>{m.monitor_no_heartbeat_logs()}</Empty>
        ) : (
          <MonitorLogsTable monitorId={monitorId} pageData={logs.data} />
        )
      }
    </MonitorWorkspacePage>
  );
}

export function MonitorIncidentsPage({ monitorId }: { monitorId: string }) {
  const detail = useMonitorQuery(monitorId);

  return (
    <MonitorWorkspacePage currentTab="incidents" detail={detail}>
      {(data) =>
        data.incidents.length === 0 ? (
          <Empty>{m.monitor_no_incidents()}</Empty>
        ) : (
          <MonitorIncidentsTable incidents={data.incidents} />
        )
      }
    </MonitorWorkspacePage>
  );
}

export function MonitorSettingsPage({ monitorId }: { monitorId: string }) {
  const detail = useMonitorQuery(monitorId);
  const list = useMonitorListQuery();
  const update = useUpdateMonitorMutation(monitorId);
  const remove = useDeleteMonitorMutation(monitorId);
  const navigate = useNavigate();

  return (
    <MonitorWorkspacePage currentTab="settings" detail={detail}>
      {(data) =>
        list.status === "pending" ? (
          <MonitorFormSkeleton />
        ) : list.status === "error" ? (
          <Error message={list.error.message} />
        ) : (
          <MonitorConfigLayout wide>
            <MonitorForm
              destinations={list.data.notificationDestinations}
              monitor={data.monitor}
              onDelete={async () => {
                await remove.mutateAsync();
                await navigate({ to: "/monitors" });
              }}
              onSubmit={async (payload) => {
                await update.mutateAsync(payload);
                await navigate({
                  params: { monitorId },
                  to: "/monitors/$monitorId",
                });
              }}
              pending={update.isPending || remove.isPending}
              selectedDestinationIds={data.notificationDestinationIds}
            />
          </MonitorConfigLayout>
        )
      }
    </MonitorWorkspacePage>
  );
}

export function EditMonitorPage({ monitorId }: { monitorId: string }) {
  return <MonitorSettingsPage monitorId={monitorId} />;
}

function MonitorConfigLayout({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return <div className={cn("w-full", !wide && "max-w-5xl")}>{children}</div>;
}
