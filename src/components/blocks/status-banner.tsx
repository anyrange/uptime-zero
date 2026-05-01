"use client";

import type { StatusType } from "@/components/blocks/status.types";

import { useStatusBlocksLabels } from "@/components/blocks/status-i18n";
import { StatusIcon as UnifiedStatusIcon } from "@/components/blocks/status-icon";
import { StatusTimestamp } from "@/components/blocks/status-timestamp";
import { cn } from "@/lib/utils";

export function StatusBanner({
  className,
  status,
}: React.ComponentProps<"div"> & {
  status?: Exclude<StatusType, "empty">;
}) {
  return (
    <StatusBannerContainer
      className={cn(
        "flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3",
        "data-[status=success]:bg-success/20",
        "data-[status=degraded]:bg-warning/20",
        "data-[status=error]:bg-destructive/20",
        "data-[status=info]:bg-info/20",
        className,
      )}
      status={status}
    >
      <StatusBannerIcon className="shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <StatusBannerMessage className="text-lg font-semibold" />
        <StatusTimestamp className="text-xs" date={new Date()} />
      </div>
    </StatusBannerContainer>
  );
}

export function StatusBannerContainer({
  className,
  children,
  status,
}: React.ComponentProps<"div"> & {
  status?: Exclude<StatusType, "empty">;
}) {
  return (
    <div
      className={cn(
        "group/status-banner overflow-hidden rounded-lg border",
        "data-[status=success]:border-success data-[status=success]:bg-success/5 dark:data-[status=success]:bg-success/10",
        "data-[status=degraded]:border-warning data-[status=degraded]:bg-warning/5 dark:data-[status=degraded]:bg-warning/10",
        "data-[status=error]:border-destructive data-[status=error]:bg-destructive/5 dark:data-[status=error]:bg-destructive/10",
        "data-[status=info]:border-info data-[status=info]:bg-info/5 dark:data-[status=info]:bg-info/10",
        className,
      )}
      data-slot="status-banner"
      data-status={status}
    >
      {children}
    </div>
  );
}

export function StatusBannerMessage({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const labels = useStatusBlocksLabels();

  return (
    <div className={cn(className)} {...props}>
      <span className="hidden group-data-[status=success]/status-banner:block">
        {labels.systemStatus.success.long}
      </span>
      <span className="hidden group-data-[status=degraded]/status-banner:block">
        {labels.systemStatus.degraded.long}
      </span>
      <span className="hidden group-data-[status=error]/status-banner:block">
        {labels.systemStatus.error.long}
      </span>
      <span className="hidden group-data-[status=info]/status-banner:block">
        {labels.systemStatus.info.long}
      </span>
    </div>
  );
}

export function StatusBannerTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-3 py-2 font-medium text-background",
        "group-data-[status=success]/status-banner:bg-success",
        "group-data-[status=degraded]/status-banner:bg-warning",
        "group-data-[status=error]/status-banner:bg-destructive",
        "group-data-[status=info]/status-banner:bg-info",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBannerContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 px-3 py-2 sm:px-4 sm:py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBannerIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon className={className} variant="banner" {...props} />
  );
}
