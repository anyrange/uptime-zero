import { endOfDay, isSameDay, startOfDay } from "date-fns";

import type { StatusBlocksLabels } from "@/components/blocks/status-i18n";

import { m } from "@/paraglide/messages.js";

/**
 * Formats a date range in a human-readable format.
 *
 * NOTE: While Intl.DateTimeFormat.formatRange() is available in modern browsers,
 * we use a custom implementation to have fine-grained control over the output format
 * and to handle edge cases like "Since", "Until", and "All time" consistently.
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatRange
 *
 * @param from - Start date of the range (optional)
 * @param to - End date of the range (optional)
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date range string
 *
 * @example
 * formatDateRange(new Date('2024-01-01'), new Date('2024-01-05'))
 * // => "January 1, 2024 - January 5, 2024"
 *
 * @example
 * formatDateRange(new Date('2024-01-01 10:00'), new Date('2024-01-01 15:00'))
 * // => "January 1, 10:00 AM - 3:00 PM"
 */
export function formatDateRange(from?: Date, to?: Date) {
  const sameDay = from && to && isSameDay(from, to);
  const isFromStartDay = from && startOfDay(from).getTime() === from.getTime();
  const isToEndDay = to && endOfDay(to).getTime() === to.getTime();

  if (sameDay) {
    if (from && to && from.getTime() === to.getTime()) {
      return formatDateTime(from);
    }
    if (from && to) {
      return `${formatDateTime(from)} - ${formatTime(to)}`;
    }
  }

  if (from && to) {
    if (isFromStartDay && isToEndDay) {
      return `${formatDate(from)} - ${formatDate(to)}`;
    }
    return `${formatDateTime(from)} - ${formatDateTime(to)}`;
  }

  if (to) {
    return m.status_block_date_range_until({ date: formatDateTime(to) });
  }

  if (from) {
    return m.status_block_date_range_since({ date: formatDateTime(from) });
  }

  return m.status_block_date_range_all_time();
}

/**
 * Formats a date with locale support.
 *
 * @param date - The date to format
 * @param options - Intl.DateTimeFormatOptions to customize the output
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date string
 */
export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
  locale = "en-US",
) {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  });
}

/**
 * Formats a date with abbreviated month (e.g. "Jan 15, 2024").
 *
 * @param date - The date to format
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date string with abbreviated month
 */
export function formatDateShort(date: Date, locale = "en-US") {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats a date with time, with locale support.
 *
 * @param date - The date to format
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted date and time string
 */
export function formatDateTime(date: Date, locale = "en-US") {
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

/**
 * Formats a time with locale support.
 *
 * @param date - The date to format
 * @param locale - Locale string for formatting (default: "en-US")
 * @returns A formatted time string
 */
export function formatTime(date: Date, locale = "en-US") {
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "numeric",
  });
}

import type {
  StatusReportUpdateType,
  StatusType,
} from "@/components/blocks/status.types";

/**
 * System status display messages
 * Used for displaying status banner and component statuses
 */
export const systemStatusLabels = {
  success: {
    long: m.status_block_system_success_long(),
    short: m.status_block_system_success_short(),
  },
  degraded: {
    long: m.status_block_system_degraded_long(),
    short: m.status_block_system_degraded_short(),
  },
  error: {
    long: m.status_block_system_error_long(),
    short: m.status_block_system_error_short(),
  },
  info: {
    long: m.status_block_system_maintenance_long(),
    short: m.status_block_system_maintenance_short(),
  },
  empty: {
    long: m.status_block_system_empty_long(),
    short: m.status_block_system_empty_short(),
  },
} as const satisfies Record<StatusType, { long: string; short: string }>;

/**
 * Legacy messages object for backwards compatibility
 * @deprecated Use systemStatusLabels instead
 */
export const messages = {
  long: {
    success: systemStatusLabels.success.long,
    degraded: systemStatusLabels.degraded.long,
    error: systemStatusLabels.error.long,
    info: systemStatusLabels.info.long,
    empty: systemStatusLabels.empty.long,
  },
  short: {
    success: systemStatusLabels.success.short,
    degraded: systemStatusLabels.degraded.short,
    error: systemStatusLabels.error.short,
    info: systemStatusLabels.info.short,
    empty: systemStatusLabels.empty.short,
  },
} as const;

/**
 * Request status labels
 * Used for displaying individual request statuses
 */
export const requestStatusLabels = {
  success: m.status_block_request_normal(),
  degraded: m.status_block_request_degraded(),
  error: m.status_block_request_error(),
  info: m.status_block_request_maintenance(),
  empty: m.status_block_request_no_data(),
} as const satisfies Record<StatusType, string>;

/**
 * Legacy requests object for backwards compatibility
 * @deprecated Use requestStatusLabels instead
 */
export const requests = requestStatusLabels;

/**
 * Incident status labels
 * Used for displaying incident report update statuses
 */
export const incidentStatusLabels = {
  resolved: m.status_block_incident_resolved(),
  monitoring: m.status_block_incident_monitoring(),
  identified: m.status_block_incident_identified(),
  investigating: m.status_block_incident_investigating(),
} as const satisfies Record<StatusReportUpdateType, string>;

/**
 * Legacy status object for backwards compatibility
 * @deprecated Use incidentStatusLabels instead
 */
export const status = incidentStatusLabels;

/**
 * CSS variable mappings for status colors
 * Maps StatusType to corresponding CSS custom properties
 */
export const statusColors = {
  success: "var(--success)",
  degraded: "var(--warning)",
  error: "var(--destructive)",
  info: "var(--info)",
  empty: "var(--muted)",
} as const satisfies Record<StatusType, string>;

/**
 * Legacy colors object for backwards compatibility
 * @deprecated Use statusColors instead
 */
export const colors = statusColors;

/**
 * Default labels consumed by blocks when no StatusBlocksI18nProvider is mounted.
 * Registry/web preview render with this set; the status-page app overrides via the provider.
 */
export const defaultStatusBlocksLabels = {
  systemStatus: systemStatusLabels,
  incidentStatus: incidentStatusLabels,
  requestStatus: requestStatusLabels,

  today: m.status_block_today(),
  ongoing: m.status_block_ongoing(),
  reportResolved: m.status_block_report_resolved(),
  noRecentNotifications: m.status_block_no_recent_notifications(),
  noRecentNotificationsDescription:
    m.status_block_no_recent_notifications_description(),
  noReports: m.status_block_no_reports(),
  noReportsDescription: m.status_block_no_reports_description(),
  noPublicMonitors: m.status_block_no_public_monitors(),
  noPublicMonitorsDescription: m.status_block_no_public_monitors_description(),

  themeNames: {
    light: m.status_block_theme_light(),
    dark: m.status_block_theme_dark(),
    system: m.status_block_theme_system(),
  },
  ariaToggleTheme: m.status_block_aria_toggle_theme(),

  subscribe: m.status_block_subscribe(),
  subscribeRssDescription: m.status_block_subscribe_rss_description(),
  subscribeAtomDescription: m.status_block_subscribe_atom_description(),
  subscribeJsonDescription: m.status_block_subscribe_json_description(),
  subscribeSlackDescription: m.status_block_subscribe_slack_description(),
  subscribeSshDescription: m.status_block_subscribe_ssh_description(),
  linkCopiedToClipboard: m.status_block_link_copied(),
  ariaCopyLink: m.status_block_aria_copy_link(),

  poweredBy: m.status_block_powered_by(),
  getInTouch: m.status_block_get_in_touch(),

  ariaStatusTracker: m.status_block_aria_status_tracker(),
  ariaDayStatus: (n: number) => m.status_block_aria_day_status({ day: n }),
  clickAgainToUnpin: m.status_block_click_again_to_unpin(),

  durationIn: (s: string) => m.status_block_duration_in({ duration: s }),
  durationEarlier: (s: string) =>
    m.status_block_duration_earlier({ duration: s }),
  durationFor: (s: string) => m.status_block_duration_for({ duration: s }),
  durationAcross: (s: string) =>
    m.status_block_duration_across({ duration: s }),

  formatDate: (d: Date) => formatDate(d),
  formatDateShort: (d: Date) => formatDateShort(d),
  formatDateTime: (d: Date) => formatDateTime(d),
  formatDateRange: (from?: Date, to?: Date) => formatDateRange(from, to),
  formatDateRangeParts: (from: Date, to: Date) => {
    if (isSameDay(from, to)) {
      return { from: formatDateTime(from), to: formatTime(to) };
    }
    const isFromStartDay = startOfDay(from).getTime() === from.getTime();
    const isToEndDay = endOfDay(to).getTime() === to.getTime();
    if (isFromStartDay && isToEndDay) {
      return { from: formatDate(from), to: formatDate(to) };
    }
    return { from: formatDateTime(from), to: formatDateTime(to) };
  },
} as const satisfies StatusBlocksLabels;
