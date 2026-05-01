import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function StatusBadge({ status }: { status: "up" | "down" | "unknown" }) {
  return (
    <Badge
      className={cn(
        status === "up"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : status === "down"
            ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
            : "border-zinc-500/20 bg-zinc-500/10 text-zinc-300",
      )}
      variant="outline"
    >
      {status === "up"
        ? m.common_operational()
        : status === "down"
          ? m.common_down()
          : m.common_unknown()}
    </Badge>
  );
}
