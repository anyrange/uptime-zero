import type { ReactNode } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

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
  monitorListQueryOptions,
  monitorLogsQueryOptions,
  useDeleteMonitorMutation,
  useTestMonitorMutation,
  useUpdateMonitorMutation,
} from "@/lib/queries/monitors";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { MonitorIncidentsTable } from "../-components/monitor-incidents-table";
import { MonitorLogsTable } from "../-components/monitor-logs-table";
import { useMonitorWorkspaceData } from "../-components/monitor-workspace";
import { MonitorsIndexContent } from "../-components/monitors-index-content";
import { MonitorForm } from "./monitor-form";

export function NewMonitorPage() {
  const { data } = useSuspenseQuery(monitorListQueryOptions());
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
      <MonitorConfigLayout>
        <MonitorForm
          destinations={data.notificationDestinations}
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
    </AppPage>
  );
}

export function MonitorsIndexPage() {
  const { data } = useSuspenseQuery(monitorListQueryOptions());

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
      <MonitorsIndexContent
        monitors={data.monitors}
        slowestP95ResponseMs={data.slowestP95ResponseMs}
      />
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
  const { data: logs } = useSuspenseQuery(
    monitorLogsQueryOptions(monitorId, page),
  );

  return logs.total === 0 ? (
    <Empty>{m.monitor_no_heartbeat_logs()}</Empty>
  ) : (
    <MonitorLogsTable monitorId={monitorId} pageData={logs} />
  );
}

export function MonitorIncidentsPage({ monitorId }: { monitorId: string }) {
  const { incidents } = useMonitorWorkspaceData(monitorId);

  return incidents.length === 0 ? (
    <Empty>{m.monitor_no_incidents()}</Empty>
  ) : (
    <MonitorIncidentsTable incidents={incidents} />
  );
}

export function MonitorSettingsPage({ monitorId }: { monitorId: string }) {
  const data = useMonitorWorkspaceData(monitorId);
  const { data: list } = useSuspenseQuery(monitorListQueryOptions());
  const update = useUpdateMonitorMutation(monitorId);
  const remove = useDeleteMonitorMutation(monitorId);
  const navigate = useNavigate();

  return (
    <MonitorConfigLayout wide>
      <MonitorForm
        destinations={list.notificationDestinations}
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
  );
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
