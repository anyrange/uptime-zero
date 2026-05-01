"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { InfoIcon } from "lucide-react";
import { useState } from "react";

import type {
  StatusBarData,
  StatusType,
} from "@/components/blocks/status.types";

import { useStatusBlocksLabels } from "@/components/blocks/status-i18n";
import { StatusIcon as UnifiedStatusIcon } from "@/components/blocks/status-icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface StatusComponentProps extends React.ComponentProps<"div"> {
  variant: Exclude<StatusType, "empty">;
}

export function StatusComponent({
  variant,
  className,
  children,
  ...props
}: StatusComponentProps) {
  return (
    <div
      className={cn("group/component space-y-2", className)}
      data-slot="status-component"
      data-variant={variant}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      data-slot="status-component-header"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentHeaderLeft({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      data-slot="status-component-header-left"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentHeaderRight({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-3", className)}
      data-slot="status-component-header-right"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("space-y-2", className)}
      data-slot="status-component-body"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "truncate text-base leading-5 font-medium text-foreground",
        className,
      )}
      data-slot="status-component-title"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentDescription({
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof TooltipTrigger>) {
  const isTouch = useMediaQuery("(hover: none)");
  const [open, setOpen] = useState(false);

  if (!children) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip onOpenChange={setOpen} open={open}>
        <TooltipTrigger
          className="rounded-full"
          onClick={(event) => {
            if (isTouch) {
              setOpen((current) => !current);
            }
            onClick?.(event);
          }}
          {...props}
        >
          <InfoIcon className="size-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p>{children}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StatusComponentIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon className={className} variant="component" {...props} />
  );
}

export function StatusComponentFooter({
  data,
  isLoading,
}: {
  data: StatusBarData[];
  isLoading?: boolean;
}) {
  const labels = useStatusBlocksLabels();

  return (
    <div
      className="flex items-center justify-between text-xs leading-none text-muted-foreground"
      data-slot="status-component-footer"
    >
      <div>
        {isLoading ? (
          <Skeleton className="h-3 w-18" />
        ) : data.length > 0 ? (
          formatDistanceToNowStrict(new Date(data[0].day), {
            addSuffix: true,
            unit: "day",
          })
        ) : (
          "-"
        )}
      </div>
      <div>{labels.today}</div>
    </div>
  );
}

export function StatusComponentUptime({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm leading-none text-foreground/80", className)}
      data-slot="status-component-uptime"
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusComponentStatus({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const labels = useStatusBlocksLabels();

  return (
    <div
      className={cn(
        "text-sm leading-none",
        "group-data-[variant=success]/component:text-success",
        "group-data-[variant=degraded]/component:text-warning",
        "group-data-[variant=error]/component:text-destructive",
        "group-data-[variant=info]/component:text-info",
        className,
      )}
      data-slot="status-component-status"
      {...props}
    >
      <span className="hidden group-data-[variant=success]/component:block">
        {labels.systemStatus.success.short}
      </span>
      <span className="hidden group-data-[variant=degraded]/component:block">
        {labels.systemStatus.degraded.short}
      </span>
      <span className="hidden group-data-[variant=error]/component:block">
        {labels.systemStatus.error.short}
      </span>
      <span className="hidden group-data-[variant=info]/component:block">
        {labels.systemStatus.info.short}
      </span>
    </div>
  );
}
