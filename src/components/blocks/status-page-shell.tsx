import { cn } from "@/lib/utils";

export function StatusPageShell({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-screen flex-col gap-6", className)}
      data-slot="status-page-shell"
      {...props}
    />
  );
}

export function StatusPageMain({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-2 md:px-8",
        className,
      )}
      data-slot="status-page-main"
      {...props}
    />
  );
}
