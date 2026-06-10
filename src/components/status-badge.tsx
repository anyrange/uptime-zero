import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages.js";

export function StatusBadge({ status }: { status: "up" | "down" | "unknown" }) {
  return (
    <Badge
      variant={
        status === "up"
          ? "secondary"
          : status === "down"
            ? "destructive"
            : "outline"
      }
    >
      {status === "up"
        ? m.common_operational()
        : status === "down"
          ? m.common_down()
          : m.common_unknown()}
    </Badge>
  );
}
