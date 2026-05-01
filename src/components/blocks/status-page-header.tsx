"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StatusPageHeader({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(className)}
      data-slot="status-page-header"
      {...props}
    />
  );
}

export function StatusPageHeaderContent({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <nav
      className={cn(
        "mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5 md:px-8",
        className,
      )}
      data-slot="status-page-header-content"
      {...props}
    />
  );
}

export function StatusPageHeaderBrand({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-[150px] shrink-0", className)}
      data-slot="status-page-header-brand"
      {...props}
    />
  );
}

export function StatusPageHeaderBrandButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      asChild
      className={cn("size-9 overflow-hidden rounded-lg", className)}
      data-slot="status-page-header-brand-button"
      size="icon"
      variant="outline"
      {...props}
    />
  );
}

export function StatusPageHeaderBrandFallback({
  title,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { title?: string }) {
  const initials =
    (title ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div
      className={cn(
        "flex size-9 items-center justify-center text-sm font-semibold",
        className,
      )}
      data-slot="status-page-header-brand-fallback"
      {...props}
    >
      {initials}
    </div>
  );
}

export function StatusPageHeaderNav({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("hidden flex-row gap-1 md:flex", className)}
      data-slot="status-page-header-nav"
      {...props}
    />
  );
}

export function StatusPageHeaderNavItem({
  isActive,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { isActive?: boolean }) {
  return (
    <li data-slot="status-page-header-nav-item">
      <Button
        asChild
        className={cn(
          "border text-sm",
          isActive ? "border-input" : "border-transparent",
          className,
        )}
        data-active={isActive ? "true" : undefined}
        data-slot="status-page-header-nav-item-button"
        size="sm"
        variant={isActive ? "secondary" : "ghost"}
        {...props}
      />
    </li>
  );
}

export function StatusPageHeaderActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-[150px] items-center justify-end gap-2",
        className,
      )}
      data-slot="status-page-header-actions"
      {...props}
    />
  );
}
