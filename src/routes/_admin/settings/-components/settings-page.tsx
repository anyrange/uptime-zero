import { useForm } from "@tanstack/react-form";
import { Link, useParams } from "@tanstack/react-router";
import {
  Archive,
  Bell,
  Database,
  Download,
  Globe2,
  Settings2,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { z } from "zod";

import type { AccountData, SettingsData } from "@/types";

import { Error } from "@/components/error";
import { Loading } from "@/components/loading";
import { AppPage } from "@/components/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { firstFieldError } from "@/lib/form-errors";
import { notificationSummary } from "@/lib/formatters";
import {
  useAccountQuery,
  useDeleteAccountMutation,
  useUpdateAccountMutation,
} from "@/lib/queries/auth";
import {
  providerLabel,
  useNotificationsQuery,
} from "@/lib/queries/notifications";
import {
  type MonitorImportPayload,
  useExportMonitorsMutation,
  useImportMonitorsMutation,
  useSettingsQuery,
  useUpdateRetentionMutation,
} from "@/lib/queries/settings";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const sections = [
  "general",
  "account",
  "data",
  "status-pages",
  "notifications",
  "retention",
] as const;
type SettingsSection = (typeof sections)[number];

const retentionSchema = z.object({
  heartbeatRetentionDays: z.number().int().min(1, m.validation_min_one_day()),
  incidentRetentionDays: z.number().int().min(1, m.validation_min_one_day()),
});

const accountSchema = z.object({
  name: z.string().trim().min(1, m.validation_name_required()).max(120),
});

export function SettingsPage() {
  const params = useParams({ strict: false }) as { section?: string };
  const section = sections.includes(params.section as SettingsSection)
    ? (params.section as SettingsSection)
    : "general";
  const settings = useSettingsQuery();

  return (
    <AppPage title={m.settings_title()}>
      {settings.status === "pending" ? <Loading /> : null}
      {settings.status === "error" ? (
        <Error message={settings.error.message} />
      ) : null}
      {settings.status === "success" ? (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:pt-1">
            <nav aria-label={m.settings_sections()} className="grid gap-1">
              {sections.map((item) => {
                const Icon = sectionIcon(item);
                const active = item === section;

                return (
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      active && "bg-accent text-foreground",
                    )}
                    key={item}
                    params={{ section: item }}
                    to="/settings/$section"
                  >
                    <Icon className="size-4" />
                    {sectionLabel(item)}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="flex flex-col gap-5">
            <SettingsSectionHeader section={section} />
            {section === "account" ? (
              <AccountSettings />
            ) : section === "notifications" ? (
              <NotificationsSettings />
            ) : section === "data" ? (
              <DataSettings data={settings.data} />
            ) : section === "retention" ? (
              <RetentionSettings data={settings.data} />
            ) : section === "status-pages" ? (
              <StatusPagesSettings data={settings.data} />
            ) : (
              <GeneralSettings data={settings.data} />
            )}
          </div>
        </div>
      ) : null}
    </AppPage>
  );
}

function AccountSettings() {
  const account = useAccountQuery();

  if (account.status === "pending") return <Loading />;
  if (account.status === "error") {
    return <Error message={account.error.message} />;
  }

  return <AccountSettingsContent data={account.data} />;
}

function AccountSettingsContent({ data }: { data: AccountSettingsData }) {
  const update = useUpdateAccountMutation();
  const remove = useDeleteAccountMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const form = useForm({
    defaultValues: {
      name: data.user.name,
    },
    validators: {
      onSubmit: accountSchema,
    },
    onSubmit: async ({ value }) => {
      await update.mutateAsync(value);
    },
  });

  async function handleDelete() {
    await remove.mutateAsync();
    window.location.assign("/setup");
  }

  const canDelete = confirmEmail === data.user.email && !remove.isPending;
  const providerLabels = data.accounts
    .map((account) => providerName(account.providerId))
    .join(", ");

  return (
    <div className="grid gap-5">
      <form
        className="grid gap-0 rounded-xl border"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="name"
          children={(field) => {
            const error = field.state.meta.isTouched
              ? firstFieldError(field.state.meta.errors)
              : null;

            return (
              <SettingsRow>
                <SettingsRowContent>
                  <SettingsRowLabel>
                    {m.settings_display_name()}
                  </SettingsRowLabel>
                  <SettingsRowDescription>
                    {m.settings_display_name_description()}
                  </SettingsRowDescription>
                </SettingsRowContent>
                <SettingsRowAction>
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor={field.name}>
                      {m.common_name()}
                    </FieldLabel>
                    <Input
                      aria-invalid={
                        field.state.meta.isTouched && !field.state.meta.isValid
                      }
                      className="w-full md:w-72"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    />
                    {error ? <FieldError>{error}</FieldError> : null}
                  </Field>
                </SettingsRowAction>
              </SettingsRow>
            );
          }}
        />
        {update.error ? (
          <p className="border-b px-4 py-3 text-sm text-rose-300">
            {update.error.message}
          </p>
        ) : null}
        <div className="flex justify-end px-4 py-4">
          <Button disabled={update.isPending} type="submit">
            {update.isPending ? m.settings_saving() : m.settings_save_changes()}
          </Button>
        </div>
      </form>

      <SettingsPanel>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.common_email()}</SettingsRowLabel>
            <SettingsRowDescription>{data.user.email}</SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_role()}</SettingsRowLabel>
            <SettingsRowDescription>
              {data.user.role === "admin"
                ? m.auth_administrator()
                : m.settings_user()}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_login_method()}</SettingsRowLabel>
            <SettingsRowDescription>
              {providerLabels || m.settings_no_login_method()}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>{m.settings_active_sessions()}</SettingsRowLabel>
            <SettingsRowDescription>
              {m.settings_active_sessions_summary({
                count: data.sessions.length,
              })}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>Created</SettingsRowLabel>
            <SettingsRowDescription>
              {formatDateTime(data.user.createdAt)}
            </SettingsRowDescription>
          </SettingsRowContent>
        </SettingsRow>
      </SettingsPanel>

      <SettingsPanel>
        <SettingsRow>
          <SettingsRowContent>
            <SettingsRowLabel>Delete account</SettingsRowLabel>
            <SettingsRowDescription>
              Delete this admin account and remove monitors, heartbeat history,
              incidents, status pages, notification destinations, and settings.
            </SettingsRowDescription>
            {remove.error ? (
              <p className="mt-2 text-sm text-rose-300">
                {remove.error.message}
              </p>
            ) : null}
          </SettingsRowContent>
          <SettingsRowAction>
            <Button
              onClick={() => setConfirmOpen(true)}
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-4" />
              Delete account
            </Button>
          </SettingsRowAction>
        </SettingsRow>
      </SettingsPanel>

      <AlertDialog
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setConfirmEmail("");
        }}
        open={confirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {m.settings_delete_account_title()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {m.settings_delete_account_description({
                email: data.user.email,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoComplete="off"
            onChange={(event) => setConfirmEmail(event.target.value)}
            placeholder={data.user.email}
            value={confirmEmail}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {m.common_cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {remove.isPending
                ? m.settings_deleting()
                : m.settings_delete_account()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GeneralSettings({ data }: { data: SettingsData }) {
  const published = data.statusPages.filter(
    (page) => page.published === 1,
  ).length;

  return (
    <SettingsPanel>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_monitors()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_active_monitors_summary({
              count: data.monitors.length,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
        <SettingsRowAction>
          <Button asChild variant="outline">
            <Link to="/monitors/new">{m.settings_new_monitor()}</Link>
          </Button>
        </SettingsRowAction>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_open_incidents()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_unresolved_incidents_summary({
              count: data.openIncidentCount,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_status_pages()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_status_pages_published_summary({
              published,
              total: data.statusPages.length,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
        <SettingsRowAction>
          <Button asChild variant="outline">
            <Link to="/status-pages">{m.settings_open_pages()}</Link>
          </Button>
        </SettingsRowAction>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_notifications()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_alert_destinations_summary({
              count: data.notificationDestinations.length,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
        <SettingsRowAction>
          <Button asChild variant="outline">
            <Link to="/notifications">{m.common_manage()}</Link>
          </Button>
        </SettingsRowAction>
      </SettingsRow>
    </SettingsPanel>
  );
}

function DataSettings({ data }: { data: SettingsData }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMonitors = useExportMonitorsMutation();
  const importMonitors = useImportMonitorsMutation();
  const [importError, setImportError] = useState<string | null>(null);

  async function handleExport() {
    const exported = await exportMonitors.mutateAsync();
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uptime-monitors-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    try {
      const payload = JSON.parse(await file.text()) as MonitorImportPayload;
      await importMonitors.mutateAsync(payload);
    } catch (error) {
      setImportError(errorMessage(error));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const importedCount = importMonitors.data?.imported;

  return (
    <SettingsPanel>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_export_monitors()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_export_monitors_description({
              count: data.monitors.length,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
        <SettingsRowAction>
          <Button
            disabled={exportMonitors.isPending}
            onClick={() => void handleExport()}
            type="button"
            variant="outline"
          >
            <Download className="size-4" />
            {m.settings_export()}
          </Button>
        </SettingsRowAction>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_import_monitors()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_import_monitors_description()}
          </SettingsRowDescription>
          {importedCount ? (
            <p className="mt-2 text-sm text-emerald-300">
              {m.settings_imported_monitors({ count: importedCount })}
            </p>
          ) : null}
          {importError || importMonitors.error ? (
            <p className="mt-2 text-sm text-rose-300">
              {importError ?? errorMessage(importMonitors.error)}
            </p>
          ) : null}
        </SettingsRowContent>
        <SettingsRowAction>
          <input
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) =>
              void handleImport(event.currentTarget.files?.[0])
            }
            ref={fileInputRef}
            type="file"
          />
          <Button
            disabled={importMonitors.isPending}
            onClick={() => fileInputRef.current?.click()}
            type="button"
            variant="outline"
          >
            <Upload className="size-4" />
            {m.settings_import()}
          </Button>
        </SettingsRowAction>
      </SettingsRow>
    </SettingsPanel>
  );
}

function errorMessage(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : m.settings_import_failed();
}

type AccountSettingsData = AccountData;

function providerName(providerId: string) {
  return providerId === "credential"
    ? m.settings_email_password()
    : providerId
      ? providerId
      : m.common_unknown();
}

function formatDateTime(value: Date | string | number | null) {
  if (!value) return m.common_unknown();
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? m.common_unknown()
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function StatusPagesSettings({ data }: { data: SettingsData }) {
  const published = data.statusPages.filter(
    (page) => page.published === 1,
  ).length;

  return (
    <SettingsPanel>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_pages()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_status_pages_configured_summary({
              configured: data.statusPages.length,
              published,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
        <SettingsRowAction>
          <Button asChild variant="outline">
            <Link to="/status-pages">{m.settings_open_status_pages()}</Link>
          </Button>
        </SettingsRowAction>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_monitor_bindings()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_status_page_links_summary({
              count: data.statusPageLinks.length,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
      </SettingsRow>
    </SettingsPanel>
  );
}

function NotificationsSettings() {
  const notifications = useNotificationsQuery();

  if (notifications.status === "pending") return <Loading />;
  if (notifications.status === "error") {
    return <Error message={notifications.error.message} />;
  }

  const providerCounts = notifications.data.destinations.reduce<
    Record<"discord" | "webhook" | "telegram", number>
  >(
    (counts, destination) => {
      counts[destination.provider] += 1;
      return counts;
    },
    { discord: 0, webhook: 0, telegram: 0 },
  );

  return (
    <SettingsPanel>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_destinations()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_destinations_summary({
              count: notifications.data.destinations.length,
            })}
          </SettingsRowDescription>
        </SettingsRowContent>
        <SettingsRowAction>
          <Button asChild variant="outline">
            <Link to="/notifications">{m.settings_manage_notifications()}</Link>
          </Button>
        </SettingsRowAction>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_providers()}</SettingsRowLabel>
          <SettingsRowDescription>
            {m.settings_provider_counts_summary(providerCounts)}
          </SettingsRowDescription>
        </SettingsRowContent>
      </SettingsRow>
      <SettingsRow>
        <SettingsRowContent>
          <SettingsRowLabel>{m.settings_recent_notifiers()}</SettingsRowLabel>
          <SettingsRowDescription>
            {notifications.data.destinations.length > 0
              ? notifications.data.destinations
                  .slice(0, 3)
                  .map(
                    (destination) =>
                      `${destination.name} (${providerLabel(destination.provider)}: ${notificationSummary(destination)})`,
                  )
                  .join("; ")
              : m.settings_no_notifiers()}
          </SettingsRowDescription>
        </SettingsRowContent>
      </SettingsRow>
    </SettingsPanel>
  );
}

function RetentionSettings({ data }: { data: SettingsData }) {
  const update = useUpdateRetentionMutation();
  const form = useForm({
    defaultValues: {
      heartbeatRetentionDays: data.settings.heartbeatRetentionDays,
      incidentRetentionDays: data.settings.incidentRetentionDays,
    },
    validators: {
      onSubmit: retentionSchema,
    },
    onSubmit: async ({ value }) => {
      await update.mutateAsync(value);
    },
  });

  return (
    <form
      className="grid gap-0 rounded-xl border"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="heartbeatRetentionDays"
        children={(field) => {
          const error = field.state.meta.isTouched
            ? firstFieldError(field.state.meta.errors)
            : null;

          return (
            <SettingsRow>
              <SettingsRowContent>
                <SettingsRowLabel>
                  {m.settings_heartbeat_retention()}
                </SettingsRowLabel>
                <SettingsRowDescription>
                  {m.settings_heartbeat_retention_description()}
                </SettingsRowDescription>
              </SettingsRowContent>
              <SettingsRowAction>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={field.name}>
                    {m.settings_days()}
                  </FieldLabel>
                  <Input
                    aria-invalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    className="w-32"
                    id={field.name}
                    min={1}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(Number(event.target.value || 0))
                    }
                    type="number"
                    value={field.state.value}
                  />
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              </SettingsRowAction>
            </SettingsRow>
          );
        }}
      />
      <form.Field
        name="incidentRetentionDays"
        children={(field) => {
          const error = field.state.meta.isTouched
            ? firstFieldError(field.state.meta.errors)
            : null;

          return (
            <SettingsRow>
              <SettingsRowContent>
                <SettingsRowLabel>
                  {m.settings_closed_incident_retention()}
                </SettingsRowLabel>
                <SettingsRowDescription>
                  {m.settings_incident_retention_description()}
                </SettingsRowDescription>
              </SettingsRowContent>
              <SettingsRowAction>
                <Field data-invalid={!!error}>
                  <FieldLabel htmlFor={field.name}>
                    {m.settings_days()}
                  </FieldLabel>
                  <Input
                    aria-invalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    className="w-32"
                    id={field.name}
                    min={1}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(Number(event.target.value || 0))
                    }
                    type="number"
                    value={field.state.value}
                  />
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              </SettingsRowAction>
            </SettingsRow>
          );
        }}
      />
      {update.error ? (
        <p className="border-b px-4 py-3 text-sm text-rose-300">
          {update.error.message}
        </p>
      ) : null}
      <div className="flex justify-end px-4 py-4">
        <Button disabled={update.isPending} type="submit">
          {m.settings_save_changes()}
        </Button>
      </div>
    </form>
  );
}

function SettingsPanel({ children }: { children: ReactNode }) {
  return <div className="grid gap-0 rounded-xl border">{children}</div>;
}

function SettingsRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 border-b px-4 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:has-[[data-slot=settings-row-action]]:py-4">
      {children}
    </div>
  );
}

function SettingsRowContent({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

function SettingsRowLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground">{children}</h3>;
}

function SettingsRowDescription({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
  );
}

function SettingsRowAction({ children }: { children: ReactNode }) {
  return (
    <div className="flex md:justify-end" data-slot="settings-row-action">
      {children}
    </div>
  );
}

function SettingsSectionHeader({ section }: { section: SettingsSection }) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="text-xl leading-7 font-semibold tracking-normal">
        {sectionLabel(section)}
      </h2>
      <p className="text-sm leading-5 text-muted-foreground">
        <SettingsSectionDescription section={section} />
      </p>
    </header>
  );
}

function SettingsSectionDescription({ section }: { section: SettingsSection }) {
  switch (section) {
    case "general":
      return m.settings_general_description();
    case "account":
      return m.settings_account_description();
    case "data":
      return m.settings_data_description();
    case "status-pages":
      return m.settings_status_pages_description();
    case "notifications":
      return m.settings_notifications_description();
    case "retention":
      return m.settings_retention_description();
  }
}

function sectionLabel(section: SettingsSection) {
  switch (section) {
    case "general":
      return m.settings_general();
    case "account":
      return m.settings_account();
    case "data":
      return m.settings_data();
    case "status-pages":
      return m.settings_status_pages();
    case "notifications":
      return m.settings_notifications();
    case "retention":
      return m.settings_retention();
  }
}

function sectionIcon(section: SettingsSection) {
  switch (section) {
    case "general":
      return Settings2;
    case "account":
      return User;
    case "data":
      return Database;
    case "status-pages":
      return Globe2;
    case "notifications":
      return Bell;
    case "retention":
      return Archive;
  }
}
