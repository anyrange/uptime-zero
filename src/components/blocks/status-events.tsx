"use client";

import { formatDistanceStrict } from "date-fns";
import { Check } from "lucide-react";

import type { StatusReportUpdateType } from "@/components/blocks/status.types";

import { useStatusBlocksLabels } from "@/components/blocks/status-i18n";
import { StatusTimestamp } from "@/components/blocks/status-timestamp";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function StatusEventGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-label={m.status_block_events_and_updates()}
      className={cn("flex flex-col gap-4", className)}
      data-slot="status-event-group"
      role="feed"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEvent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("relative flex flex-col gap-2", className)}
      data-slot="status-event"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventContent({
  className,
  hoverable = true,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/60 bg-card/70 px-4 py-4 shadow-sm transition",
        "data-[hoverable=true]:hover:border-border data-[hoverable=true]:hover:bg-card",
        className,
      )}
      data-hoverable={hoverable}
      data-slot="status-event-content"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("font-medium text-foreground", className)}
      data-slot="status-event-title"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventTitleCheck({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const labels = useStatusBlocksLabels();

  return (
    <div
      className={cn("flex items-center pl-1", className)}
      data-slot="status-event-title-check"
      {...props}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger aria-label={labels.reportResolved}>
            <div className="rounded-full border border-success/20 bg-success/10 p-0.5 text-success">
              <Check aria-hidden="true" className="size-3 shrink-0" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{labels.reportResolved}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function StatusEventAffected({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      data-slot="status-event-affected"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventAffectedBadge({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Badge
      className={cn("text-[11px]", className)}
      data-slot="status-event-affected-badge"
      variant="secondary"
      {...props}
    >
      {children}
    </Badge>
  );
}

export function StatusEventDate({
  className,
  date,
  ...props
}: React.ComponentProps<"div"> & {
  date: Date;
}) {
  const labels = useStatusBlocksLabels();
  const isFuture = date > new Date();
  const distance = formatDistanceStrict(date, new Date(), { addSuffix: true });

  return (
    <div
      className={cn("flex gap-2 lg:flex-col", className)}
      data-slot="status-event-date"
      {...props}
    >
      <div className="font-medium text-foreground">
        {labels.formatDateShort(date)}
      </div>
      <Badge
        className={cn(
          "text-[11px]",
          isFuture ? "bg-info text-background dark:text-foreground" : "",
        )}
        data-slot="status-event-date-badge"
        variant="secondary"
      >
        {distance}
      </Badge>
    </div>
  );
}

export function StatusEventAside({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className="lg:absolute lg:top-0 lg:-left-32 lg:h-full"
      data-slot="status-event-aside"
    >
      <div className={cn("lg:sticky lg:top-0 lg:left-0", className)} {...props}>
        {children}
      </div>
    </div>
  );
}

interface StatusReportUpdate {
  date: Date;
  message: string;
  status: StatusReportUpdateType;
}

export function StatusEventTimelineReport({
  className,
  updates,
  withDot = true,
  maxUpdates,
  renderMessage,
  ...props
}: React.ComponentProps<"div"> & {
  updates: StatusReportUpdate[];
  withDot?: boolean;
  maxUpdates?: number;
  renderMessage?: (message: string) => React.ReactNode;
}) {
  const labels = useStatusBlocksLabels();
  const sortedUpdates = [...updates].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
  const displayedUpdates = maxUpdates
    ? sortedUpdates.slice(0, maxUpdates)
    : sortedUpdates;

  return (
    <div
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="status-event-timeline-report"
      {...props}
    >
      {displayedUpdates.map((update, index) => {
        let durationText: string | undefined;

        if (index === 0) {
          const startedAt = new Date(
            sortedUpdates[sortedUpdates.length - 1].date,
          );
          const duration = formatDistanceStrict(startedAt, update.date);
          if (duration !== "0 seconds" && update.status === "resolved") {
            durationText = labels.durationIn(duration);
          }
        } else {
          const lastUpdateDate = new Date(displayedUpdates[index - 1].date);
          durationText = labels.durationEarlier(
            formatDistanceStrict(update.date, lastUpdateDate),
          );
        }

        return (
          <StatusEventTimelineReportUpdate
            duration={durationText}
            isLast={index === displayedUpdates.length - 1}
            key={`${update.status}-${update.date.toISOString()}`}
            renderMessage={renderMessage}
            report={update}
            withDot={withDot}
            withSeparator={index !== displayedUpdates.length - 1}
          />
        );
      })}
    </div>
  );
}

export function StatusEventTimelineReportUpdate({
  report,
  duration,
  withSeparator = true,
  withDot = true,
  isLast = false,
  renderMessage,
}: {
  report: StatusReportUpdate;
  withSeparator?: boolean;
  duration?: string;
  withDot?: boolean;
  isLast?: boolean;
  renderMessage?: (message: string) => React.ReactNode;
}) {
  const labels = useStatusBlocksLabels();

  return (
    <div
      className="group"
      data-slot="status-event-timeline-report-update"
      data-variant={report.status}
    >
      <div className="flex items-start gap-4">
        {withDot ? (
          <div className="flex flex-col">
            <div className="flex h-5 items-center justify-center">
              <StatusEventTimelineDot />
            </div>
            {withSeparator ? <StatusEventTimelineSeparator /> : null}
          </div>
        ) : null}
        <div className={cn(isLast ? "mb-0" : "mb-2")}>
          <StatusEventTimelineTitle>
            <span>{labels.incidentStatus[report.status]}</span>
            <span className="text-muted-foreground/70"> · </span>
            <span className="text-xs text-muted-foreground">
              <StatusTimestamp date={report.date}>
                {labels.formatDateTime(report.date)}
              </StatusTimestamp>
            </span>
            {duration ? (
              <span className="ml-2 text-xs text-muted-foreground/70">
                {duration}
              </span>
            ) : null}
          </StatusEventTimelineTitle>
          <StatusEventTimelineMessage>
            {report.message.trim() === "" ? (
              <span className="text-muted-foreground/70">-</span>
            ) : renderMessage ? (
              renderMessage(report.message)
            ) : (
              report.message
            )}
          </StatusEventTimelineMessage>
        </div>
      </div>
    </div>
  );
}

export function StatusEventTimelineTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm font-medium text-foreground", className)}
      data-slot="status-event-timeline-title"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventTimelineMessage({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("py-1.5 text-sm text-muted-foreground", className)}
      data-slot="status-event-timeline-message"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusEventTimelineDot({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "size-2.5 shrink-0 rounded-full bg-muted",
        "group-data-[variant=resolved]:bg-success",
        "group-data-[variant=monitoring]:bg-info",
        "group-data-[variant=identified]:bg-warning",
        "group-data-[variant=investigating]:bg-destructive",
        "group-data-[variant=maintenance]:bg-info",
        className,
      )}
      data-slot="status-event-timeline-dot"
      {...props}
    />
  );
}

export function StatusEventTimelineSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "mx-auto flex-1",
        "group-data-[variant=resolved]:bg-success",
        "group-data-[variant=monitoring]:bg-info",
        "group-data-[variant=identified]:bg-warning",
        "group-data-[variant=investigating]:bg-destructive",
        "group-data-[variant=maintenance]:bg-info",
        className,
      )}
      data-slot="status-event-timeline-separator"
      orientation="vertical"
      {...props}
    />
  );
}
