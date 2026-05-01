"use client";

import { createContext, useContext } from "react";

import type {
  StatusReportUpdateType,
  StatusType,
  ThemeValue,
} from "@/components/blocks/status.types";

import {
  defaultStatusBlocksLabels,
  type formatDate,
  type formatDateRange,
  type formatDateShort,
  type formatDateTime,
} from "@/components/blocks/status.utils";

export interface StatusBlocksLabels {
  systemStatus: Record<StatusType, { long: string; short: string }>;
  incidentStatus: Record<StatusReportUpdateType, string>;
  requestStatus: Record<StatusType, string>;
  today: string;
  ongoing: string;
  reportResolved: string;
  noRecentNotifications: string;
  noRecentNotificationsDescription: string;
  noReports: string;
  noReportsDescription: string;
  noPublicMonitors: string;
  noPublicMonitorsDescription: string;
  themeNames: Record<ThemeValue, string>;
  ariaToggleTheme: string;
  subscribe: string;
  subscribeRssDescription: string;
  subscribeAtomDescription: string;
  subscribeJsonDescription: string;
  subscribeSlackDescription: string;
  subscribeSshDescription: string;
  linkCopiedToClipboard: string;
  ariaCopyLink: string;
  poweredBy: string;
  getInTouch: string;
  ariaStatusTracker: string;
  ariaDayStatus: (n: number) => string;
  clickAgainToUnpin: string;
  durationIn: (s: string) => string;
  durationEarlier: (s: string) => string;
  durationFor: (s: string) => string;
  durationAcross: (s: string) => string;
  formatDate: typeof formatDate;
  formatDateShort: typeof formatDateShort;
  formatDateTime: typeof formatDateTime;
  formatDateRange: typeof formatDateRange;
  formatDateRangeParts: (from: Date, to: Date) => { from: string; to: string };
}

const StatusBlocksLabelsContext = createContext<StatusBlocksLabels>(
  defaultStatusBlocksLabels,
);

export function StatusBlocksI18nProvider({
  value,
  children,
}: {
  value?: Partial<StatusBlocksLabels>;
  children: React.ReactNode;
}) {
  return (
    <StatusBlocksLabelsContext.Provider
      value={{ ...defaultStatusBlocksLabels, ...value }}
    >
      {children}
    </StatusBlocksLabelsContext.Provider>
  );
}

export function useStatusBlocksLabels() {
  return useContext(StatusBlocksLabelsContext);
}
