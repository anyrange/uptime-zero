"use client";

import { useMemo } from "react";

import type { StatusReport } from "@/components/blocks/status.types";

import { StatusBlankEvents } from "@/components/blocks/status-blank";
import {
  StatusEvent,
  StatusEventAffected,
  StatusEventAffectedBadge,
  StatusEventAside,
  StatusEventContent,
  StatusEventDate,
  StatusEventGroup,
  StatusEventTimelineReport,
  StatusEventTitle,
} from "@/components/blocks/status-events";
import { useStatusBlocksLabels } from "@/components/blocks/status-i18n";

type UnifiedEvent = {
  id: number;
  title: string;
  startDate: Date;
  data: StatusReport;
};

export function StatusFeed({
  statusReports = [],
  footer,
  emptyAction,
  renderReportMessage,
  renderEvent,
  ...props
}: React.ComponentProps<"div"> & {
  statusReports?: StatusReport[];
  footer?: React.ReactNode;
  emptyAction?: React.ReactNode;
  renderReportMessage?: (message: string) => React.ReactNode;
  renderEvent?: (
    event: { type: "report"; data: StatusReport },
    children: React.ReactNode,
  ) => React.ReactNode;
}) {
  const labels = useStatusBlocksLabels();

  const unifiedEvents = useMemo<UnifiedEvent[]>(() => {
    return [...statusReports]
      .map((report) => ({
        id: report.id,
        title: report.title,
        startDate:
          report.updates[report.updates.length - 1]?.date || new Date(),
        data: report,
      }))
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }, [statusReports]);

  if (unifiedEvents.length === 0) {
    return (
      <StatusBlankEvents
        action={emptyAction}
        description={labels.noRecentNotificationsDescription}
        title={labels.noRecentNotifications}
      />
    );
  }

  return (
    <>
      <StatusEventGroup data-slot="status-feed" {...props}>
        {unifiedEvents.map((event) => {
          const node = (
            <StatusEventContent hoverable={false}>
              <StatusEventTitle>{event.data.title}</StatusEventTitle>
              {event.data.affected.length > 0 ? (
                <StatusEventAffected>
                  {event.data.affected.map((affected, index) => (
                    <StatusEventAffectedBadge key={index}>
                      {affected}
                    </StatusEventAffectedBadge>
                  ))}
                </StatusEventAffected>
              ) : null}
              <StatusEventTimelineReport
                renderMessage={renderReportMessage}
                updates={event.data.updates}
              />
            </StatusEventContent>
          );

          return (
            <StatusEvent key={`report-${event.id}`}>
              <StatusEventAside>
                <StatusEventDate date={event.startDate} />
              </StatusEventAside>
              {renderEvent
                ? renderEvent({ type: "report", data: event.data }, node)
                : node}
            </StatusEvent>
          );
        })}
      </StatusEventGroup>
      {footer}
    </>
  );
}
