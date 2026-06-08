import type { FormEvent, ReactNode } from "react";

import { Webhook } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  DiscordNotificationConfig,
  NotificationDestinationDetail,
  NotificationDestinationListItem,
  NotificationHeader,
  NotificationProvider,
  TelegramNotificationConfig,
  WebhookNotificationConfig,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Discord } from "@/components/ui/svgs/discord";
import { Telegram } from "@/components/ui/svgs/telegram";
import { formatDateTime, notificationSummary } from "@/lib/formatters";
import {
  providerLabel,
  useCreateNotificationMutation,
  useDeleteNotificationMutation,
  useNotificationQuery,
  useNotificationsQuery,
  useTestNotificationMutation,
  useUpdateNotificationMutation,
  type NotificationPayload,
} from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import { NotificationsSkeleton } from "./notifications-skeleton";

type NotificationFormState = {
  name: string;
  provider: NotificationProvider;
  webhookUrl: string;
  url: string;
  headers: NotificationHeader[];
  botToken: string;
  chatId: string;
  messageThreadId: string;
  monitorIds: string[];
};

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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftProvider, setDraftProvider] =
    useState<NotificationProvider>("discord");

  if (notifications.status === "pending") {
    return <NotificationsSkeleton />;
  }
  if (notifications.status === "error") {
    return <ErrorState message={notifications.error.message} />;
  }

  const { destinations, monitors } = notifications.data;
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
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard>
            <CardDescription>{m.notification_notifiers()}</CardDescription>
            <CardTitle>{destinations.length}</CardTitle>
          </MetricCard>
          <MetricCard>
            <CardDescription>{m.notification_assignments()}</CardDescription>
            <CardTitle>{assignedCount}</CardTitle>
          </MetricCard>
          <MetricCard>
            <CardDescription>{m.monitor_monitors()}</CardDescription>
            <CardTitle>{monitors.length}</CardTitle>
          </MetricCard>
          <MetricCard>
            <CardDescription>{m.notification_providers()}</CardDescription>
            <CardTitle>
              {destinations.length > 0
                ? new Set(destinations.map((item) => item.provider)).size
                : 0}
            </CardTitle>
          </MetricCard>
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
                    onDelete={() => remove.mutate(destination.id)}
                    onEdit={() => {
                      setEditingId(destination.id);
                      setDraftProvider(destination.provider);
                      setSheetOpen(true);
                    }}
                    onTest={() => test.mutate(destination.id)}
                    pending={
                      remove.isPending || test.isPending || create.isPending
                    }
                  />
                ))
              )}
            </div>
          </section>

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
                <Item asChild key={item.provider} variant="outline">
                  <button
                    className="cursor-pointer hover:border-ring/60 hover:bg-muted/50 focus-visible:border-ring"
                    onClick={() => {
                      setEditingId(null);
                      setDraftProvider(item.provider);
                      setSheetOpen(true);
                    }}
                    type="button"
                  >
                    <ItemMedia>
                      <ProviderIcon provider={item.provider} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{item.title}</ItemTitle>
                      <ItemDescription>{item.description}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Badge variant="outline">{m.common_add()}</Badge>
                    </ItemActions>
                  </button>
                </Item>
              ))}
            </div>
          </section>
        </div>
      </div>

      <NotificationSheet
        editingId={editingId}
        monitors={monitors}
        onClose={() => {
          setSheetOpen(false);
          setEditingId(null);
        }}
        open={sheetOpen}
        provider={draftProvider}
      />
    </AppPage>
  );
}

function NotificationSheet({
  open,
  onClose,
  provider,
  editingId,
  monitors,
}: {
  open: boolean;
  onClose: () => void;
  provider: NotificationProvider;
  editingId: string | null;
  monitors: Array<{ id: string; name: string; kind: string }>;
}) {
  const detail = useNotificationQuery(editingId);
  const create = useCreateNotificationMutation();
  const update = useUpdateNotificationMutation(editingId ?? "");
  const test = useTestNotificationMutation();

  const [formState, setFormState] = useState<NotificationFormState>(() =>
    emptyFormState(provider),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const destination = detail.data ?? null;
  const pending = create.isPending || update.isPending || test.isPending;
  const allSelected =
    monitors.length > 0 && formState.monitorIds.length === monitors.length;

  useEffect(() => {
    if (!open) {
      return;
    }
    if (editingId) {
      return;
    }
    setFormState(emptyFormState(provider));
    setSubmitError(null);
  }, [editingId, open, provider]);

  useEffect(() => {
    if (!open || !editingId || !destination) {
      return;
    }
    setFormState(fromDestination(destination));
    setSubmitError(null);
  }, [destination, editingId, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const payload = buildPayload(formState);
    if (!payload) {
      setSubmitError(m.notification_complete_required());
      return;
    }

    try {
      if (editingId) {
        await update.mutateAsync(payload);
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : m.notification_save_failed(),
      );
    }
  }

  return (
    <Sheet onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <SheetContent
        className="w-full overflow-y-auto sm:!max-w-2xl"
        side="right"
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>
            {editingId ? m.notification_edit() : m.notification_create_new()}
          </SheetTitle>
          <SheetDescription>
            {m.notification_form_description()}
          </SheetDescription>
        </SheetHeader>

        {!editingId || detail.status === "success" ? (
          <form className="grid gap-5 px-6 py-6" onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <Field>
                <FieldLabel>{m.notification_provider()}</FieldLabel>
                <Select
                  disabled={Boolean(editingId)}
                  onValueChange={(value) =>
                    setFormState(emptyFormState(value as NotificationProvider))
                  }
                  value={formState.provider}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discord">
                      <ProviderOption provider="discord" />
                    </SelectItem>
                    <SelectItem value="webhook">
                      <ProviderOption provider="webhook" />
                    </SelectItem>
                    <SelectItem value="telegram">
                      <ProviderOption provider="telegram" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{m.common_name()}</FieldLabel>
                <Input
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={formState.name}
                />
              </Field>
            </div>

            {formState.provider === "discord" ? (
              <Field>
                <FieldLabel>{m.notification_discord_webhook_url()}</FieldLabel>
                <Input
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      webhookUrl: event.target.value,
                    }))
                  }
                  type="url"
                  value={formState.webhookUrl}
                />
              </Field>
            ) : null}

            {formState.provider === "webhook" ? (
              <div className="grid gap-4">
                <Field>
                  <FieldLabel>{m.notification_endpoint_url()}</FieldLabel>
                  <Input
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        url: event.target.value,
                      }))
                    }
                    type="url"
                    value={formState.url}
                  />
                </Field>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {m.notification_custom_headers()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {m.notification_custom_headers_description()}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        setFormState((current) => ({
                          ...current,
                          headers: [...current.headers, { key: "", value: "" }],
                        }))
                      }
                      type="button"
                      variant="outline"
                    >
                      {m.notification_add_header()}
                    </Button>
                  </div>
                  {formState.headers.length === 0 ? (
                    <Empty>{m.notification_no_custom_headers()}</Empty>
                  ) : (
                    formState.headers.map((header, index) => (
                      <div
                        className="grid gap-3 rounded-lg border border-border/70 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        key={`${index}-${header.key}`}
                      >
                        <Input
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              headers: current.headers.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, key: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="X-Token"
                          value={header.key}
                        />
                        <Input
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              headers: current.headers.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, value: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="secret"
                          value={header.value}
                        />
                        <Button
                          onClick={() =>
                            setFormState((current) => ({
                              ...current,
                              headers: current.headers.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            }))
                          }
                          type="button"
                          variant="destructive"
                        >
                          {m.notification_remove_header()}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {formState.provider === "telegram" ? (
              <div className="grid gap-4">
                <Field>
                  <FieldLabel>{m.notification_bot_token()}</FieldLabel>
                  <Input
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        botToken: event.target.value,
                      }))
                    }
                    value={formState.botToken}
                  />
                </Field>
                <Field>
                  <FieldLabel>{m.notification_chat_id()}</FieldLabel>
                  <Input
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        chatId: event.target.value,
                      }))
                    }
                    value={formState.chatId}
                  />
                </Field>
                <Field>
                  <FieldLabel>{m.notification_message_thread_id()}</FieldLabel>
                  <Input
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        messageThreadId: event.target.value,
                      }))
                    }
                    value={formState.messageThreadId}
                  />
                </Field>
              </div>
            ) : null}

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {m.notification_assigned_monitors()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {m.notification_assigned_monitors_description()}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setFormState((current) => ({
                        ...current,
                        monitorIds: checked
                          ? monitors.map((monitor) => monitor.id)
                          : [],
                      }))
                    }
                  />
                  {m.notification_select_all()}
                </label>
              </div>

              {monitors.length === 0 ? (
                <Empty>{m.notification_no_monitors()}</Empty>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {monitors.map((monitor) => {
                    const checked = formState.monitorIds.includes(monitor.id);
                    return (
                      <Item
                        asChild
                        key={monitor.id}
                        size="sm"
                        variant="outline"
                      >
                        <label>
                          <ItemMedia>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) =>
                                setFormState((current) => ({
                                  ...current,
                                  monitorIds: nextChecked
                                    ? [...current.monitorIds, monitor.id]
                                    : current.monitorIds.filter(
                                        (id) => id !== monitor.id,
                                      ),
                                }))
                              }
                            />
                          </ItemMedia>
                          <ItemContent>
                            <ItemTitle>{monitor.name}</ItemTitle>
                            <ItemDescription>
                              {String(monitor.kind).toUpperCase()}
                            </ItemDescription>
                          </ItemContent>
                        </label>
                      </Item>
                    );
                  })}
                </div>
              )}
            </div>

            {submitError ? (
              <p className="text-sm text-rose-300">{submitError}</p>
            ) : null}

            <SheetFooter className="gap-2 px-0 pb-6 sm:justify-between">
              <div>
                {editingId ? (
                  <Button
                    disabled={pending}
                    onClick={() => test.mutate(editingId)}
                    type="button"
                    variant="outline"
                  >
                    {m.notification_send_test()}
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button onClick={onClose} type="button" variant="outline">
                  {m.common_cancel()}
                </Button>
                <Button disabled={pending} type="submit">
                  {editingId
                    ? m.notification_save_notifier()
                    : m.notification_create_new()}
                </Button>
              </div>
            </SheetFooter>
          </form>
        ) : detail.status === "error" ? (
          <div className="px-6 py-6">
            <ErrorState message={detail.error.message} />
          </div>
        ) : (
          <div className="px-6 py-6">
            <NotificationsSkeleton />
          </div>
        )}
      </SheetContent>
    </Sheet>
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
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  pending: boolean;
}) {
  return (
    <Item className="items-start gap-4 p-4" variant="outline">
      <ItemMedia>
        <ProviderIcon provider={destination.provider} />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <ItemTitle className="text-base">{destination.name}</ItemTitle>
            <ItemDescription>
              {providerLabel(destination.provider)}
            </ItemDescription>
          </div>
          <Badge className="shrink-0" variant="outline">
            {m.notification_monitor_count({ count: destination.monitorCount })}
          </Badge>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
          <Summary>
            <SummaryLabel>{m.notification_target()}</SummaryLabel>
            <SummaryValue>{notificationSummary(destination)}</SummaryValue>
          </Summary>
          <Summary>
            <SummaryLabel>{m.notification_updated()}</SummaryLabel>
            <SummaryValue>{formatDateTime(destination.updatedAt)}</SummaryValue>
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

        <ItemActions className="flex-wrap justify-end">
          <Button onClick={onEdit} size="sm" type="button" variant="outline">
            {m.common_edit()}
          </Button>
          <Button
            disabled={pending}
            onClick={onTest}
            size="sm"
            type="button"
            variant="outline"
          >
            {m.notification_test()}
          </Button>
          <Button
            disabled={pending}
            onClick={onDelete}
            size="sm"
            type="button"
            variant="destructive"
          >
            {m.common_delete()}
          </Button>
        </ItemActions>
      </ItemContent>
    </Item>
  );
}

function ProviderIcon({ provider }: { provider: NotificationProvider }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {provider === "discord" ? (
        <Discord aria-hidden="true" className="size-5" />
      ) : provider === "telegram" ? (
        <Telegram aria-hidden="true" className="size-5" />
      ) : (
        <Webhook aria-hidden="true" className="size-5 text-muted-foreground" />
      )}
    </span>
  );
}

function ProviderOption({ provider }: { provider: NotificationProvider }) {
  return (
    <span className="flex items-center gap-2">
      {provider === "discord" ? (
        <Discord aria-hidden="true" className="size-4" />
      ) : provider === "telegram" ? (
        <Telegram aria-hidden="true" className="size-4" />
      ) : (
        <Webhook aria-hidden="true" className="size-4 text-muted-foreground" />
      )}
      <span>{providerLabel(provider)}</span>
    </span>
  );
}

function MetricCard({ children }: { children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>{children}</CardHeader>
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

function emptyFormState(provider: NotificationProvider): NotificationFormState {
  return {
    name: "",
    provider,
    webhookUrl: "",
    url: "",
    headers: [],
    botToken: "",
    chatId: "",
    messageThreadId: "",
    monitorIds: [],
  };
}

function fromDestination(
  destination: NotificationDestinationDetail,
): NotificationFormState {
  if (destination.provider === "discord") {
    const config = destination.config as DiscordNotificationConfig;
    return {
      ...emptyFormState("discord"),
      name: destination.name,
      webhookUrl: config.webhookUrl,
      monitorIds: destination.monitorIds,
    };
  }

  if (destination.provider === "webhook") {
    const config = destination.config as WebhookNotificationConfig;
    return {
      ...emptyFormState("webhook"),
      name: destination.name,
      url: config.url,
      headers: config.headers ?? [],
      monitorIds: destination.monitorIds,
    };
  }

  const config = destination.config as TelegramNotificationConfig;
  return {
    ...emptyFormState("telegram"),
    name: destination.name,
    botToken: config.botToken,
    chatId: config.chatId,
    messageThreadId: config.messageThreadId ?? "",
    monitorIds: destination.monitorIds,
  };
}

function buildPayload(
  state: NotificationFormState,
): NotificationPayload | null {
  const monitorIds = dedupeIds(state.monitorIds);
  if (!state.name.trim()) {
    return null;
  }

  if (state.provider === "discord") {
    if (!state.webhookUrl.trim()) {
      return null;
    }
    return {
      name: state.name.trim(),
      provider: "discord",
      webhookUrl: state.webhookUrl.trim(),
      monitorIds,
    };
  }

  if (state.provider === "webhook") {
    if (!state.url.trim()) {
      return null;
    }
    return {
      name: state.name.trim(),
      provider: "webhook",
      url: state.url.trim(),
      headers: state.headers.filter((header) => header.key.trim().length > 0),
      monitorIds,
    };
  }

  if (!state.botToken.trim() || !state.chatId.trim()) {
    return null;
  }

  return {
    name: state.name.trim(),
    provider: "telegram",
    botToken: state.botToken.trim(),
    chatId: state.chatId.trim(),
    messageThreadId: state.messageThreadId.trim() || null,
    monitorIds,
  };
}

function dedupeIds(ids: string[]) {
  return [...new Set(ids)];
}
