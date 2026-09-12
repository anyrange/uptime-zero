import { Link, useParams } from "@tanstack/react-router";
import { Archive, Bell, Database, Globe2, Settings2, User } from "lucide-react";
import { z } from "zod";

import type { SettingsData } from "@/types";

import { Error } from "@/components/error";
import { AppPage } from "@/components/page";
import { Button } from "@/components/ui/button";
import { notificationSummary } from "@/lib/formatters";
import {
  providerLabel,
  useNotificationsQuery,
} from "@/lib/queries/notifications";
import { useSettingsQuery } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { AccountSettings } from "./account-settings";
import { DataSettings } from "./data-settings";
import { RetentionSettings } from "./retention-settings";
import {
  SettingsPanel,
  SettingsRow,
  SettingsRowAction,
  SettingsRowContent,
  SettingsRowDescription,
  SettingsRowLabel,
} from "./settings-layout";
import { SettingsSkeleton } from "./settings-skeleton";

const sections = [
  "general",
  "account",
  "data",
  "status-pages",
  "notifications",
  "retention",
] as const;

type SettingsSection = (typeof sections)[number];

export function SettingsPage() {
  const params = z
    .object({ section: z.string().optional() })
    .safeParse(useParams({ strict: false }));

  const parsedSection = z
    .enum(sections)
    .safeParse(params.success ? params.data.section : undefined);

  const section: SettingsSection = parsedSection.success
    ? parsedSection.data
    : "general";

  const settings = useSettingsQuery();

  return (
    <AppPage title={m.settings_title()}>
      {settings.status === "pending" ? <SettingsSkeleton /> : null}
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

  if (notifications.status === "pending") return <SettingsSkeleton />;

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
