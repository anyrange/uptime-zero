import { Link } from "@tanstack/react-router";

import type { IncidentRecord } from "@/types";

import { IncidentStatusBadge } from "@/components/incident-status-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { m } from "@/paraglide/messages.js";

export function IncidentList({
  incidents,
  monitorId,
}: {
  incidents: IncidentRecord[];
  monitorId: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">
            {m.monitor_recent_incidents()}
          </h2>
          <p className="text-sm text-muted-foreground">
            {m.incident_latest_for_monitor()}
          </p>
        </div>
        <div>
          <Link
            className="text-sm text-muted-foreground underline underline-offset-4"
            params={{ monitorId }}
            to="/monitors/$monitorId/incidents"
          >
            {m.incident_view_all()}
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {m.incident_no_incidents()}
          </p>
        ) : (
          incidents.slice(0, 5).map((incident) => (
            <Card key={incident.id} size="sm">
              <CardHeader className="gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {incident.title}
                  </p>
                  <IncidentStatusBadge status={incident.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {incident.body ?? m.incident_no_summary_short()}
                </p>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
