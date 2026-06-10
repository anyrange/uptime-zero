import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages.js";

export function IncidentStatusBadge({ status }: { status: "open" | "closed" }) {
  return (
    <Badge variant={status === "open" ? "destructive" : "success"}>
      {status === "open" ? m.incident_open() : m.incident_closed()}
    </Badge>
  );
}
