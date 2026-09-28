import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, Bell, Database, Globe2, Settings2, User } from "lucide-react";
import { z } from "zod";

import type { SettingsData } from "@/types";

import { Button } from "@/components/ui/button";
import { notificationSummary } from "@/lib/formatters";
import {
  notificationsQueryOptions,
  providerLabel,
} from "@/lib/queries/notifications";
import { settingsQueryOptions } from "@/lib/queries/settings";
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

const sections = [
  "general",
  "account",
  "data",
  "status-pages",
  "notifications",
  "retention",
] as const;

export const settingsSectionSchema = z.enum(sections);

export type SettingsSection = z.infer<typeof settingsSectionSchema>;

export function SettingsNavigation() {
  return (
    <nav aria-label={m.settings_sections()} className="grid gap-1">
      {sections.map((item) => {
        const Icon = sectionIcon(item);

        return (
          <Link
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
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
  );
}

export function SettingsSectionPage({ section }: { section: SettingsSection }) {
  const { data } = useSuspenseQuery(settingsQueryOptions());

  return (
    <>
      <SettingsSectionHeader section={section} />
      {section === "account" ? (
        <AccountSettings />
      ) : section === "notifications" ? (
        <NotificationsSettings />
      ) : section === "data" ? (
        <DataSettings data={data} />
      ) : section === "retention" ? (
        <RetentionSettings data={data} />
      ) : section === "status-pages" ? (
        <StatusPagesSettings data={data} />
      ) : (
        <GeneralSettings data={data} />
      )}
    </>
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
  const { data: notifications } = useSuspenseQuery(notificationsQueryOptions());

  const providerCounts = notifications.destinations.reduce<
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
              count: notifications.destinations.length,
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
            {notifications.destinations.length > 0
              ? notifications.destinations
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
