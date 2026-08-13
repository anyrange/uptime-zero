import type { FormEvent } from "react";

import { useEffect, useState } from "react";
import { z } from "zod";

import type {
  NotificationDestinationDetail,
  NotificationDestinationMonitorSummary,
  NotificationHeader,
  NotificationProvider,
} from "@/types";

import { SensitiveInput } from "@/components/sensitive-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
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
import {
  providerLabel,
  type NotificationPayload,
} from "@/lib/queries/notifications";
import { m } from "@/paraglide/messages.js";

import { NotificationProviderIcon } from "./notification-provider-icon";

const notificationProviderSchema = z.enum(["discord", "webhook", "telegram"]);

export type NotificationFormState = {
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

export function NotificationForm({
  defaultState,
  formId,
  lockedProvider = false,
  monitors,
  submitError,
  onInvalid,
  onSubmit,
}: {
  defaultState: NotificationFormState;
  formId: string;
  lockedProvider?: boolean;
  monitors: NotificationDestinationMonitorSummary[];
  submitError: string | null;
  onInvalid: () => void;
  onSubmit: (payload: NotificationPayload) => Promise<void>;
}) {
  const [formState, setFormState] =
    useState<NotificationFormState>(defaultState);
  const allSelected =
    monitors.length > 0 && formState.monitorIds.length === monitors.length;

  useEffect(() => {
    setFormState(defaultState);
  }, [defaultState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildNotificationPayload(formState);
    if (!payload) {
      onInvalid();
      return;
    }

    await onSubmit(payload);
  }

  return (
    <form className="grid gap-5 px-6 py-6" id={formId} onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <Field>
          <FieldLabel>{m.notification_provider()}</FieldLabel>
          <Select
            disabled={lockedProvider}
            onValueChange={(value) => {
              const provider = notificationProviderSchema.safeParse(value);
              if (provider.success) {
                setFormState(emptyNotificationFormState(provider.data));
              }
            }}
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
            <SensitiveInput
              autoComplete="off"
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
                <Item asChild key={monitor.id} size="sm" variant="outline">
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
    </form>
  );
}

export function emptyNotificationFormState(
  provider: NotificationProvider,
): NotificationFormState {
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

export function notificationFormStateFromDestination(
  destination: NotificationDestinationDetail,
): NotificationFormState {
  if (destination.provider === "discord") {
    const config = destination.config;
    return {
      ...emptyNotificationFormState("discord"),
      name: destination.name,
      webhookUrl: config.webhookUrl,
      monitorIds: destination.monitorIds,
    };
  }

  if (destination.provider === "webhook") {
    const config = destination.config;
    return {
      ...emptyNotificationFormState("webhook"),
      name: destination.name,
      url: config.url,
      headers: config.headers ?? [],
      monitorIds: destination.monitorIds,
    };
  }

  const config = destination.config;
  return {
    ...emptyNotificationFormState("telegram"),
    name: destination.name,
    botToken: config.botToken,
    chatId: config.chatId,
    messageThreadId: config.messageThreadId ?? "",
    monitorIds: destination.monitorIds,
  };
}

function ProviderOption({ provider }: { provider: NotificationProvider }) {
  return (
    <span className="flex items-center gap-2">
      <NotificationProviderIcon provider={provider} size="sm" />
      <span>{providerLabel(provider)}</span>
    </span>
  );
}

function buildNotificationPayload(
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
