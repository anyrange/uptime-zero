"use client";

import { useStatusBlocksLabels } from "@/components/blocks/status-i18n";
import { cn } from "@/lib/utils";

export function StatusBlankContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-8 text-center",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBlankTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-medium text-foreground", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusBlankDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusBlankContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export function StatusBlankEvents({
  title,
  description,
  action,
  ...props
}: React.ComponentProps<typeof StatusBlankContainer> & {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const labels = useStatusBlocksLabels();

  return (
    <StatusBlankContainer {...props}>
      <div className="grid h-24 w-full max-w-xs place-items-center rounded-xl border border-border/50 bg-background/60">
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              className="h-10 w-16 rounded-lg border border-border/50 bg-card/80"
              key={index}
            />
          ))}
        </div>
      </div>
      <StatusBlankContent>
        <StatusBlankTitle>{title ?? labels.noReports}</StatusBlankTitle>
        <StatusBlankDescription>
          {description ?? labels.noReportsDescription}
        </StatusBlankDescription>
      </StatusBlankContent>
      {action}
    </StatusBlankContainer>
  );
}

export function StatusBlankMonitors({
  title,
  description,
  action,
  ...props
}: React.ComponentProps<typeof StatusBlankContainer> & {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const labels = useStatusBlocksLabels();

  return (
    <StatusBlankContainer {...props}>
      <div className="grid h-24 w-full max-w-xs place-items-center rounded-xl border border-border/50 bg-background/60">
        <div className="flex w-full items-end gap-1 px-4">
          {Array.from({ length: 12 }, (_, index) => (
            <div
              className="flex-1 rounded-sm bg-muted"
              key={index}
              style={{ height: `${index % 4 === 0 ? 28 : 42}px` }}
            />
          ))}
        </div>
      </div>
      <StatusBlankContent>
        <StatusBlankTitle>{title ?? labels.noPublicMonitors}</StatusBlankTitle>
        <StatusBlankDescription>
          {description ?? labels.noPublicMonitorsDescription}
        </StatusBlankDescription>
      </StatusBlankContent>
      {action}
    </StatusBlankContainer>
  );
}
