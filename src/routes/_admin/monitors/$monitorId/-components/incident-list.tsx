import { Link } from "@tanstack/react-router";

import type { IncidentRecord } from "@/types";

import { IncidentStatusBadge } from "@/components/incident-status-badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { m } from "@/paraglide/messages.js";

export function IncidentList({
  incidents,
  monitorId,
}: {
  incidents: IncidentRecord[];
  monitorId: string;
}) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-base">
          {m.monitor_recent_incidents()}
        </CardTitle>
        <CardDescription>{m.incident_latest_for_monitor()}</CardDescription>
        <CardAction>
          <Link
            className="text-sm text-muted-foreground underline underline-offset-4"
            params={{ monitorId }}
            to="/monitors/$monitorId/incidents"
          >
            {m.incident_view_all()}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {m.incident_no_incidents()}
          </p>
        ) : (
          incidents.slice(0, 5).map((incident) => (
            <div
              className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]"
              key={incident.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {incident.title}
                  </p>
                  <IncidentStatusBadge status={incident.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {incident.body ?? m.incident_no_summary_short()}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
