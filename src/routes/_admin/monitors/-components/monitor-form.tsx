import {
  ActivityIcon,
  Globe2Icon,
  PlusIcon,
  RadioTowerIcon,
  ServerIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { MonitorPayload } from "@/lib/queries/monitors";
import type {
  MonitorAssertion,
  MonitorKind,
  MonitorRecord,
  NotificationDestinationRecord,
} from "@/types";

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { notificationSummary } from "@/lib/formatters";
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
  usePauseMonitorMutation,
  useResumeMonitorMutation,
} from "@/lib/queries/monitors";
import { providerLabel } from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import { AssertionEditor } from "./assertion-editor";
import { PushEndpoint } from "./push-endpoint";

const monitorKindSchema = z.enum(["http", "dns", "push"]);

const heartbeatModeSchema = z.enum(["interval", "cron"]);

const monitorIntervalOptions = [60, 300, 600, 1800, 3600] as const;

export function MonitorForm({
  destinations,
  monitor,
  selectedDestinationIds = [],
  pending,
  testPending,
  onSubmit,
  onTest,
  onDelete,
}: {
  destinations: NotificationDestinationRecord[];
  monitor?: MonitorRecord;
  selectedDestinationIds?: string[];
  pending?: boolean;
  testPending?: boolean;
  onSubmit: (payload: MonitorPayload) => Promise<void>;
  onTest?: (payload: MonitorPayload) => Promise<void>;
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

  const actionPending =
    pending || testPending || pause.isPending || resume.isPending;

  function validateCurrentConfig() {
    return validateMonitorConfigForm({
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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const result = validateCurrentConfig();

    if (!result.ok) {
      setSubmitError(result.error);

      return;
    }

    await onSubmit(result.payload);
  }

  async function handleTest() {
    if (!onTest) return;
    setSubmitError(null);

    const result = validateCurrentConfig();

    if (!result.ok) {
      toast.error(m.monitor_test_failed(), { description: result.error });

      return;
    }

    await onTest(result.payload);
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
                  const kind = monitorKindSchema.safeParse(value);

                  if (kind.success) handleKindChange(kind.data);
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
                  onValueChange={(value) => {
                    const mode = heartbeatModeSchema.safeParse(value);

                    if (mode.success) setHeartbeatMode(mode.data);
                  }}
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
        <PushEndpoint monitor={monitor} />
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
            {onTest && kind !== "push" ? (
              <Button
                disabled={actionPending}
                onClick={handleTest}
                type="button"
                variant="outline"
              >
                <ActivityIcon data-icon="inline-start" />
                {testPending
                  ? m.monitor_testing_configuration()
                  : m.monitor_test_configuration()}
              </Button>
            ) : null}
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
