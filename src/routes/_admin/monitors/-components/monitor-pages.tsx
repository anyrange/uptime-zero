import { Link, useNavigate } from "@tanstack/react-router";
import { Globe2Icon, PlusIcon, RadioTowerIcon, ServerIcon } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type { MonitorPayload } from "@/lib/queries/monitors";
import type {
  DnsRecordType,
  HeartbeatMode,
  JsonOperator,
  MonitorAssertion,
  MonitorKind,
  MonitorRecord,
  NotificationDestinationRecord,
  TextAssertionOperator,
} from "@/types";

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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { notificationSummary } from "@/lib/formatters";
import {
  dnsRecordTypes,
  jsonOperators,
  textAssertionOperators,
} from "@/lib/monitor/assertions";
import {
  addMonitorAssertion,
  applyMonitorKindChange,
  createBodyJsonAssertion,
  createBodyTextAssertion,
  createDnsAssertion,
  createHeaderAssertion,
  createStatusAssertion,
  getMonitorConfigFormDefaults,
  removeMonitorAssertion,
  updateMonitorAssertion,
  validateMonitorConfigForm,
} from "@/lib/monitor/form";
import {
  useCreateMonitorMutation,
  useDeleteMonitorMutation,
  useMonitorListQuery,
  useMonitorLogsQuery,
  useMonitorQuery,
  usePauseMonitorMutation,
  useResumeMonitorMutation,
  useUpdateMonitorMutation,
} from "@/lib/queries/monitors";
import { providerLabel } from "@/lib/queries/notifications";
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

const textOperatorOptions = textAssertionOperators;
const jsonOperatorOptions = jsonOperators;
const dnsRecordTypeOptions = dnsRecordTypes;
const monitorIntervalOptions = [60, 300, 600, 1800, 3600] as const;

export function NewMonitorPage() {
  const data = useMonitorListQuery();
  const create = useCreateMonitorMutation();
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
            pending={create.isPending}
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

function MonitorForm({
  destinations,
  monitor,
  selectedDestinationIds = [],
  pending,
  onSubmit,
  onDelete,
}: {
  destinations: NotificationDestinationRecord[];
  monitor?: MonitorRecord;
  selectedDestinationIds?: string[];
  pending?: boolean;
  onSubmit: (payload: MonitorPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const defaults = getMonitorConfigFormDefaults(
    monitor,
    selectedDestinationIds,
  );
  const [name, setName] = useState(defaults.name);
  const [kind, setKind] = useState(defaults.kind);
  const [target, setTarget] = useState(defaults.target);
  const [intervalSec, setIntervalSec] = useState(defaults.intervalSec);
  const [timeoutMs, setTimeoutMs] = useState(defaults.timeoutMs);
  const [retries, setRetries] = useState(defaults.retries);
  const [assertions, setAssertions] = useState<MonitorAssertion[]>(
    defaults.assertions,
  );
  const [heartbeatMode, setHeartbeatMode] = useState(defaults.heartbeatMode);
  const [heartbeatCron, setHeartbeatCron] = useState(defaults.heartbeatCron);
  const [heartbeatGraceSec, setHeartbeatGraceSec] = useState(
    defaults.heartbeatGraceSec,
  );
  const [heartbeatTimezone, setHeartbeatTimezone] = useState(
    defaults.heartbeatTimezone,
  );
  const [notificationGraceSec, setNotificationGraceSec] = useState(
    defaults.notificationGraceSec,
  );
  const [notificationDestinationIds, setNotificationDestinationIds] = useState(
    defaults.notificationDestinationIds,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pause = usePauseMonitorMutation(monitor?.id ?? "");
  const resume = useResumeMonitorMutation(monitor?.id ?? "");
  const actionPending = pending || pause.isPending || resume.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const result = validateMonitorConfigForm({
      name,
      kind,
      target,
      intervalSec,
      timeoutMs,
      retries,
      assertions,
      heartbeatMode,
      heartbeatCron,
      heartbeatGraceSec,
      heartbeatTimezone,
      notificationGraceSec,
      active: monitor ? monitor.active === 1 : true,
      notificationDestinationIds,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }

    await onSubmit(result.payload);
  }

  function handleKindChange(nextKind: MonitorKind) {
    const nextState = applyMonitorKindChange({ assertions, target }, nextKind);
    setKind(nextKind);
    setAssertions(nextState.assertions);
    setTarget(nextState.target);
  }

  const intervalIndex = getMonitorIntervalIndex(intervalSec);

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{m.monitor_details()}</CardTitle>
          <CardDescription>{m.monitor_details_description()}</CardDescription>
          {monitor ? (
            <CardAction>
              <Button
                disabled={actionPending}
                onClick={() =>
                  monitor.active === 1 ? pause.mutate() : resume.mutate()
                }
                type="button"
                variant="outline"
              >
                {monitor.active === 1 ? m.monitor_pause() : m.monitor_resume()}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="monitor-name">{m.monitor_name()}</FieldLabel>
              <Input
                id="monitor-name"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </Field>
            <FieldSet className="gap-3">
              <FieldLegend>{m.monitor_type()}</FieldLegend>
              <ToggleGroup
                aria-label={m.monitor_type()}
                className="grid w-full grid-cols-1 md:grid-cols-3"
                onValueChange={(value) => {
                  if (value) handleKindChange(value as MonitorKind);
                }}
                type="single"
                value={kind}
                variant="outline"
              >
                <ToggleGroupItem
                  className="h-auto min-w-0 justify-start px-4 py-3"
                  value="http"
                >
                  <Globe2Icon />
                  {m.monitor_http()}
                </ToggleGroupItem>
                <ToggleGroupItem
                  className="h-auto min-w-0 justify-start px-4 py-3"
                  value="dns"
                >
                  <ServerIcon />
                  {m.monitor_dns()}
                </ToggleGroupItem>
                <ToggleGroupItem
                  className="h-auto min-w-0 justify-start px-4 py-3"
                  value="push"
                >
                  <RadioTowerIcon />
                  {m.monitor_heartbeat()}
                </ToggleGroupItem>
              </ToggleGroup>
            </FieldSet>
          </FieldGroup>
        </CardContent>
      </Card>

      {kind !== "push" ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              {kind === "http"
                ? m.monitor_http_request()
                : m.monitor_dns_query()}
            </CardTitle>
            <CardDescription>
              {kind === "http"
                ? m.monitor_http_request_description()
                : m.monitor_dns_query_description()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel htmlFor="monitor-target">
                  {kind === "dns" ? m.monitor_hostname() : m.monitor_url()}
                </FieldLabel>
                <Input
                  id="monitor-target"
                  onChange={(event) => setTarget(event.target.value)}
                  placeholder={
                    kind === "dns"
                      ? m.monitor_hostname_placeholder()
                      : m.monitor_url_placeholder()
                  }
                  value={target}
                />
                <FieldDescription>
                  {kind === "dns"
                    ? m.monitor_target_hostname_description()
                    : m.monitor_target_url_description()}
                </FieldDescription>
              </Field>

              <FieldSet className="gap-3">
                <FieldLegend>{m.monitor_assertions()}</FieldLegend>
                <FieldDescription>
                  {kind === "dns"
                    ? m.monitor_assertions_dns_description()
                    : m.monitor_assertions_http_description()}
                </FieldDescription>
                <div className="flex flex-wrap gap-2">
                  {kind === "http" ? (
                    <>
                      <Button
                        onClick={() =>
                          setAssertions(
                            addMonitorAssertion(
                              assertions,
                              createStatusAssertion(),
                            ),
                          )
                        }
                        type="button"
                        variant="outline"
                      >
                        <PlusIcon data-icon="inline-start" />
                        {m.monitor_add_status()}
                      </Button>
                      <Button
                        onClick={() =>
                          setAssertions(
                            addMonitorAssertion(
                              assertions,
                              createHeaderAssertion(),
                            ),
                          )
                        }
                        type="button"
                        variant="outline"
                      >
                        <PlusIcon data-icon="inline-start" />
                        {m.monitor_add_header()}
                      </Button>
                      <Button
                        onClick={() =>
                          setAssertions(
                            addMonitorAssertion(
                              assertions,
                              createBodyTextAssertion(),
                            ),
                          )
                        }
                        type="button"
                        variant="outline"
                      >
                        <PlusIcon data-icon="inline-start" />
                        {m.monitor_add_body()}
                      </Button>
                      <Button
                        onClick={() =>
                          setAssertions(
                            addMonitorAssertion(
                              assertions,
                              createBodyJsonAssertion(),
                            ),
                          )
                        }
                        type="button"
                        variant="outline"
                      >
                        <PlusIcon data-icon="inline-start" />
                        {m.monitor_add_json()}
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() =>
                        setAssertions(
                          addMonitorAssertion(assertions, createDnsAssertion()),
                        )
                      }
                      type="button"
                      variant="outline"
                    >
                      <PlusIcon data-icon="inline-start" />
                      {m.monitor_add_record()}
                    </Button>
                  )}
                </div>

                {assertions.length === 0 ? (
                  <Empty className="p-4">
                    <EmptyHeader>
                      <EmptyDescription>
                        {m.monitor_no_assertions()}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <FieldGroup className="gap-3">
                    {assertions.map((assertion) => (
                      <AssertionEditor
                        assertion={assertion}
                        key={assertion.id}
                        onChange={(nextAssertion) =>
                          setAssertions(
                            updateMonitorAssertion(assertions, nextAssertion),
                          )
                        }
                        onRemove={() =>
                          setAssertions(
                            removeMonitorAssertion(assertions, assertion.id),
                          )
                        }
                      />
                    ))}
                  </FieldGroup>
                )}
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>{m.monitor_request_limits()}</CardTitle>
          <CardDescription>
            {m.monitor_request_limits_description()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>{m.monitor_timeout_ms()}</FieldLabel>
              <NumberField
                min={1}
                onValueChange={(value) => setTimeoutMs(value ?? 0)}
                value={timeoutMs}
              >
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_retries()}</FieldLabel>
              <NumberField
                min={0}
                onValueChange={(value) => setRetries(value ?? 0)}
                value={retries}
              >
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>{m.monitor_scheduling()}</CardTitle>
          <CardDescription>
            {m.monitor_scheduling_description()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            {kind === "push" ? (
              <Field>
                <FieldLabel>{m.monitor_heartbeat_mode()}</FieldLabel>
                <Select
                  onValueChange={(value) =>
                    setHeartbeatMode(value as HeartbeatMode)
                  }
                  value={heartbeatMode}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="interval">
                        {m.monitor_heartbeat_interval()}
                      </SelectItem>
                      <SelectItem value="cron">
                        {m.monitor_heartbeat_cron()}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {kind !== "push" || heartbeatMode === "interval" ? (
              <Field>
                <FieldLabel>{m.monitor_periodicity()}</FieldLabel>
                <FieldDescription>
                  {m.monitor_periodicity_description({
                    interval: monitorIntervalLabel(intervalSec),
                  })}
                </FieldDescription>
                <Slider
                  aria-label={m.monitor_periodicity()}
                  max={monitorIntervalOptions.length - 1}
                  min={0}
                  onValueChange={([nextIndex]) => {
                    const nextInterval = monitorIntervalOptions[nextIndex ?? 0];
                    if (nextInterval) setIntervalSec(nextInterval);
                  }}
                  step={1}
                  value={[intervalIndex]}
                />
                <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                  {monitorIntervalOptions.map((option) => (
                    <span key={option}>{monitorIntervalLabel(option)}</span>
                  ))}
                </div>
              </Field>
            ) : (
              <FieldGroup className="grid gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel>
                    {m.monitor_heartbeat_cron_expression()}
                  </FieldLabel>
                  <Input
                    onChange={(event) => setHeartbeatCron(event.target.value)}
                    value={heartbeatCron ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel>{m.monitor_heartbeat_timezone()}</FieldLabel>
                  <Input
                    onChange={(event) =>
                      setHeartbeatTimezone(event.target.value)
                    }
                    value={heartbeatTimezone ?? ""}
                  />
                </Field>
                <Field>
                  <FieldLabel>{m.monitor_heartbeat_grace_seconds()}</FieldLabel>
                  <NumberField
                    min={1}
                    onValueChange={(value) => setHeartbeatGraceSec(value ?? 0)}
                    value={heartbeatGraceSec ?? 0}
                  >
                    <NumberFieldGroup>
                      <NumberFieldDecrement />
                      <NumberFieldInput />
                      <NumberFieldIncrement />
                    </NumberFieldGroup>
                  </NumberField>
                </Field>
              </FieldGroup>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {monitor?.kind === "push" && monitor.pushToken ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{m.monitor_push_endpoint()}</CardTitle>
            <CardDescription>
              {m.monitor_push_endpoint_description()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={`/api/push/${monitor.pushToken}`} />
          </CardContent>
        </Card>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>{m.monitor_notifications()}</CardTitle>
          <CardDescription>
            {m.monitor_notifications_description()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>{m.monitor_notification_grace_seconds()}</FieldLabel>
              <NumberField
                min={0}
                onValueChange={(value) => setNotificationGraceSec(value ?? 0)}
                value={notificationGraceSec}
              >
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
              <FieldDescription>
                {m.monitor_notification_grace_seconds_description()}
              </FieldDescription>
            </Field>
            {destinations.length === 0 ? (
              <Empty className="p-4">
                <EmptyHeader>
                  <EmptyDescription>
                    {m.monitor_no_destinations()}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <FieldGroup className="grid gap-3 md:grid-cols-2">
                {destinations.map((destination) => {
                  const checked = notificationDestinationIds.includes(
                    destination.id,
                  );
                  return (
                    <Item
                      asChild
                      key={destination.id}
                      size="sm"
                      variant="outline"
                    >
                      <label>
                        <ItemMedia>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              if (nextChecked) {
                                setNotificationDestinationIds([
                                  ...notificationDestinationIds,
                                  destination.id,
                                ]);
                                return;
                              }
                              setNotificationDestinationIds(
                                notificationDestinationIds.filter(
                                  (id) => id !== destination.id,
                                ),
                              );
                            }}
                          />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{destination.name}</ItemTitle>
                          <ItemDescription>
                            {providerLabel(destination.provider)} ·{" "}
                            {notificationSummary(destination)}
                          </ItemDescription>
                        </ItemContent>
                      </label>
                    </Item>
                  );
                })}
              </FieldGroup>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-2 border-t">
          <div className="flex flex-wrap gap-2">
            <Button disabled={actionPending} type="submit">
              {monitor ? m.monitor_save() : m.monitor_create()}
            </Button>
            {onDelete ? (
              <Button
                disabled={actionPending}
                onClick={onDelete}
                type="button"
                variant="destructive"
              >
                {m.common_delete()}
              </Button>
            ) : null}
          </div>
          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
        </CardFooter>
      </Card>
    </form>
  );
}

function getMonitorIntervalIndex(intervalSec: number) {
  return monitorIntervalOptions.reduce((closestIndex, option, index) => {
    const closest = monitorIntervalOptions[closestIndex];
    return Math.abs(option - intervalSec) < Math.abs(closest - intervalSec)
      ? index
      : closestIndex;
  }, 0);
}

function monitorIntervalLabel(intervalSec: number) {
  return intervalSec < 3600
    ? m.common_minutes_short({ value: intervalSec / 60 })
    : m.common_hours_short({ value: intervalSec / 3600 });
}

function AssertionEditor({
  assertion,
  onChange,
  onRemove,
}: {
  assertion: MonitorAssertion;
  onChange: (assertion: MonitorAssertion) => void;
  onRemove: () => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{assertionSummary(assertion)}</CardTitle>
        <CardAction>
          <Button onClick={onRemove} type="button" variant="outline">
            {m.monitor_remove_assertion()}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {assertion.type === "status" ? (
          <Field>
            <FieldLabel>{m.monitor_expected_status()}</FieldLabel>
            <NumberField
              min={100}
              onValueChange={(value) =>
                onChange({
                  ...assertion,
                  expected: value ?? 0,
                })
              }
              value={assertion.expected}
            >
              <NumberFieldGroup>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldGroup>
            </NumberField>
          </Field>
        ) : null}

        {assertion.type === "header" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>{m.monitor_header()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, header: event.target.value })
                }
                value={assertion.header}
              />
            </Field>
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) =>
                  onChange({
                    ...assertion,
                    operator: value as TextAssertionOperator,
                  })
                }
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {textOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}

        {assertion.type === "body" && assertion.source === "text" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) =>
                  onChange({
                    ...assertion,
                    operator: value as TextAssertionOperator,
                  })
                }
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {textOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}

        {assertion.type === "body" && assertion.source === "json" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>{m.monitor_json_path()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, path: event.target.value })
                }
                value={assertion.path}
              />
            </Field>
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) =>
                  onChange({
                    ...assertion,
                    operator: value as JsonOperator,
                  })
                }
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {jsonOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_expected_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}

        {assertion.type === "record" ? (
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>{m.monitor_record_type()}</FieldLabel>
              <Select
                onValueChange={(value) =>
                  onChange({
                    ...assertion,
                    recordType: value as DnsRecordType,
                  })
                }
                value={assertion.recordType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {dnsRecordTypeOptions.map((recordType) => (
                      <SelectItem key={recordType} value={recordType}>
                        {recordType}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_operator()}</FieldLabel>
              <Select
                onValueChange={(value) =>
                  onChange({
                    ...assertion,
                    operator: value as TextAssertionOperator,
                  })
                }
                value={assertion.operator}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {textOperatorOptions.map((operator) => (
                      <SelectItem key={operator} value={operator}>
                        {operator}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{m.monitor_expected_value()}</FieldLabel>
              <Input
                onChange={(event) =>
                  onChange({ ...assertion, value: event.target.value })
                }
                value={assertion.value}
              />
            </Field>
          </FieldGroup>
        ) : null}
      </CardContent>
    </Card>
  );
}

function assertionSummary(assertion: MonitorAssertion) {
  switch (assertion.type) {
    case "status":
      return m.monitor_assertion_status_summary({
        expected: assertion.expected,
      });
    case "header":
      return m.monitor_assertion_header_summary({
        header: assertion.header,
        operator: assertion.operator,
        value: assertion.value,
      });
    case "body":
      return assertion.source === "json"
        ? m.monitor_assertion_json_summary({
            path: assertion.path,
            operator: assertion.operator,
            value: assertion.value,
          })
        : m.monitor_assertion_body_summary({
            operator: assertion.operator,
            value: assertion.value,
          });
    case "record":
      return m.monitor_assertion_record_summary({
        recordType: assertion.recordType,
        operator: assertion.operator,
        value: assertion.value,
      });
  }
}
