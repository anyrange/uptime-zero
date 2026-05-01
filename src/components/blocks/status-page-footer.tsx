"use client";

import { useStatusBlocksLabels } from "@/components/blocks/status-i18n";
import { cn } from "@/lib/utils";

export function StatusPageFooter({
  className,
  ...props
}: React.ComponentProps<"footer">) {
  return (
    <footer
      className={cn(className)}
      data-slot="status-page-footer"
      {...props}
    />
  );
}

export function StatusPageFooterContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 md:px-8",
        className,
      )}
      data-slot="status-page-footer-content"
      {...props}
    />
  );
}

export function StatusPagePoweredBy({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  const labels = useStatusBlocksLabels();
  return (
    <p
      className={cn(
        "text-xs leading-none text-muted-foreground sm:text-sm",
        className,
      )}
      data-slot="status-page-powered-by"
      {...props}
    >
      {labels.poweredBy} {children}
    </p>
  );
}

export function StatusPageFooterActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-slot="status-page-footer-actions"
      {...props}
    />
  );
}
