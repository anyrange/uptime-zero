import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { privateKey } from "@/lib/api/keys";
import { permissionMiddleware } from "@/lib/api/middleware";
import { IncidentFilters } from "@/lib/schemas/incidents";
import * as incidents from "@/modules/incidents/incidents.service";

export const listIncidents = createServerFn({ method: "GET" })
  .middleware([permissionMiddleware("monitor.read")])
  .validator(IncidentFilters)
  .handler(({ data }) => incidents.search(data));

/** An incident joined with the monitor it belongs to, for the incident index. */
export type IncidentSummary = Awaited<ReturnType<typeof listIncidents>>[number];

export function incidentsQueryOptions(filters: IncidentFilters) {
  return queryOptions({
    queryKey: privateKey("incidents", filters),
    queryFn: () => listIncidents({ data: filters }),
  });
}
