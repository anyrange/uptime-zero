import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function IncidentStatusBadge({ status }: { status: "open" | "closed" }) {
  return (
    <Badge
      className={cn(
        status === "open"
          ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      )}
      variant="outline"
    >
      {status === "open" ? m.incident_open() : m.incident_closed()}
    </Badge>
  );
}
