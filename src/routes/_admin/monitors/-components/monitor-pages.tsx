import { Link, useNavigate } from "@tanstack/react-router";
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
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { notificationSummary } from "@/lib/formatters";
import {
  dnsRecordTypes,
  jsonOperators,
  textAssertionOperators,
} from "@/lib/monitor-assertions";
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
} from "@/lib/monitor-config-form";
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
  return (
    <Card className={`${wide ? "w-full" : "max-w-4xl"} px-5 py-5`}>
      {children}
    </Card>
  );
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
  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div
        className={
          monitor
            ? "grid gap-4 border-b border-border/70 pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
            : "grid gap-4 border-b border-border/70 pb-5"
        }
      >
        <Field>
          <FieldLabel>Monitor name</FieldLabel>
          <Input
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        {monitor ? (
          monitor.active === 1 ? (
            <Button
              disabled={actionPending}
              onClick={() => pause.mutate()}
              type="button"
              variant="outline"
            >
              {m.monitor_pause()}
            </Button>
          ) : (
            <Button
              disabled={actionPending}
              onClick={() => resume.mutate()}
              type="button"
              variant="outline"
            >
              {m.monitor_resume()}
            </Button>
          )
        ) : null}
      </div>

      <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-2">
        <Field>
          <FieldLabel>{m.monitor_type()}</FieldLabel>
          <Select
            onValueChange={(value) => {
              const nextKind = value as MonitorKind;
              const nextState = applyMonitorKindChange(
                { assertions, target },
                nextKind,
              );
              setKind(nextKind);
              setAssertions(nextState.assertions);
              setTarget(nextState.target);
            }}
            value={kind}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">{m.monitor_http()}</SelectItem>
              <SelectItem value="dns">{m.monitor_dns()}</SelectItem>
              <SelectItem value="push">{m.monitor_heartbeat()}</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>{m.monitor_type_description()}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>
            {kind === "dns" ? m.monitor_hostname() : m.monitor_target()}
          </FieldLabel>
          <Input
            disabled={kind === "push"}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={
              kind === "dns" ? "example.com" : "https://example.com/health"
            }
            value={target}
          />
          <FieldDescription>
            {kind === "dns"
              ? m.monitor_target_hostname_description()
              : kind === "push"
                ? m.monitor_target_push_description()
                : m.monitor_target_url_description()}
          </FieldDescription>
        </Field>
      </div>

      <div className="grid gap-4 border-b border-border/70 pb-5 md:grid-cols-3">
        <Field>
          <FieldLabel>{m.monitor_interval_seconds()}</FieldLabel>
          <Input
            onChange={(event) =>
              setIntervalSec(Number(event.target.value || 0))
            }
            type="number"
            value={intervalSec}
          />
        </Field>
        <Field>
          <FieldLabel>{m.monitor_timeout_ms()}</FieldLabel>
          <Input
            onChange={(event) => setTimeoutMs(Number(event.target.value || 0))}
            type="number"
            value={timeoutMs}
          />
        </Field>
        <Field>
          <FieldLabel>{m.monitor_retries()}</FieldLabel>
          <Input
            onChange={(event) => setRetries(Number(event.target.value || 0))}
            type="number"
            value={retries}
          />
        </Field>
      </div>

      {kind === "push" ? (
        <div className="grid gap-4 border-b border-border/70 pb-5">
          <div>
            <h3 className="font-medium">{m.monitor_heartbeat_schedule()}</h3>
            <p className="text-sm text-muted-foreground">
              {m.monitor_heartbeat_schedule_description()}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
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
                  <SelectItem value="interval">
                    {m.monitor_heartbeat_interval()}
                  </SelectItem>
                  <SelectItem value="cron">
                    {m.monitor_heartbeat_cron()}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {heartbeatMode === "cron" ? (
              <>
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
                  <Input
                    onChange={(event) =>
                      setHeartbeatGraceSec(Number(event.target.value || 0))
                    }
                    type="number"
                    value={heartbeatGraceSec ?? 0}
                  />
                </Field>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {kind !== "push" ? (
        <div className="grid gap-4 border-b border-border/70 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">{m.monitor_assertions()}</h3>
              <p className="text-sm text-muted-foreground">
                {kind === "dns"
                  ? m.monitor_assertions_dns_description()
                  : m.monitor_assertions_http_description()}
              </p>
            </div>
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
                  {m.monitor_add_record()}
                </Button>
              )}
            </div>
          </div>

          {assertions.length === 0 ? (
            <Empty>{m.monitor_no_assertions()}</Empty>
          ) : (
            <div className="grid gap-3">
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
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 border-b border-border/70 pb-5">
        <div>
          <h3 className="font-medium">{m.monitor_notifications()}</h3>
          <p className="text-sm text-muted-foreground">
            {m.monitor_notifications_description()}
          </p>
        </div>
        <Field>
          <FieldLabel>{m.monitor_notification_grace_seconds()}</FieldLabel>
          <Input
            min={0}
            onChange={(event) =>
              setNotificationGraceSec(Number(event.target.value || 0))
            }
            type="number"
            value={notificationGraceSec}
          />
          <FieldDescription>
            {m.monitor_notification_grace_seconds_description()}
          </FieldDescription>
        </Field>
        {destinations.length === 0 ? (
          <Empty>{m.monitor_no_destinations()}</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {destinations.map((destination) => {
              const checked = notificationDestinationIds.includes(
                destination.id,
              );
              return (
                <Item asChild key={destination.id} size="sm" variant="outline">
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
          </div>
        )}
      </div>

      {monitor?.kind === "push" && monitor.pushToken ? (
        <Field>
          <FieldLabel>{m.monitor_push_endpoint()}</FieldLabel>
          <Textarea readOnly value={`/api/push/${monitor.pushToken}`} />
          <FieldDescription>
            {m.monitor_push_endpoint_description()}
          </FieldDescription>
        </Field>
      ) : null}

      {submitError ? (
        <p className="text-sm text-rose-300">{submitError}</p>
      ) : null}

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
    </form>
  );
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
    <div className="grid gap-4 rounded-lg border border-border/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{assertionSummary(assertion)}</p>
        <Button onClick={onRemove} type="button" variant="outline">
          Remove
        </Button>
      </div>

      {assertion.type === "status" ? (
        <Field>
          <FieldLabel>Expected status</FieldLabel>
          <Input
            onChange={(event) =>
              onChange({
                ...assertion,
                expected: Number(event.target.value || 0),
              })
            }
            type="number"
            value={assertion.expected}
          />
        </Field>
      ) : null}

      {assertion.type === "header" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Field>
            <FieldLabel>Header</FieldLabel>
            <Input
              onChange={(event) =>
                onChange({ ...assertion, header: event.target.value })
              }
              value={assertion.header}
            />
          </Field>
          <Field>
            <FieldLabel>Operator</FieldLabel>
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
                {textOperatorOptions.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Value</FieldLabel>
            <Input
              onChange={(event) =>
                onChange({ ...assertion, value: event.target.value })
              }
              value={assertion.value}
            />
          </Field>
        </div>
      ) : null}

      {assertion.type === "body" && assertion.source === "text" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>Operator</FieldLabel>
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
                {textOperatorOptions.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Value</FieldLabel>
            <Input
              onChange={(event) =>
                onChange({ ...assertion, value: event.target.value })
              }
              value={assertion.value}
            />
          </Field>
        </div>
      ) : null}

      {assertion.type === "body" && assertion.source === "json" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Field>
            <FieldLabel>JSON path</FieldLabel>
            <Input
              onChange={(event) =>
                onChange({ ...assertion, path: event.target.value })
              }
              value={assertion.path}
            />
          </Field>
          <Field>
            <FieldLabel>Operator</FieldLabel>
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
                {jsonOperatorOptions.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Expected value</FieldLabel>
            <Input
              onChange={(event) =>
                onChange({ ...assertion, value: event.target.value })
              }
              value={assertion.value}
            />
          </Field>
        </div>
      ) : null}

      {assertion.type === "record" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Field>
            <FieldLabel>Record type</FieldLabel>
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
                {dnsRecordTypeOptions.map((recordType) => (
                  <SelectItem key={recordType} value={recordType}>
                    {recordType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Operator</FieldLabel>
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
                {textOperatorOptions.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {operator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Expected value</FieldLabel>
            <Input
              onChange={(event) =>
                onChange({ ...assertion, value: event.target.value })
              }
              value={assertion.value}
            />
          </Field>
        </div>
      ) : null}
    </div>
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
