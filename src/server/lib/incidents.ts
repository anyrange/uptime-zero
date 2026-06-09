import type { IncidentListFilters, IncidentListRecord } from "@/types";

import { parseDateMs } from "@/server/lib/dates";

export function filterIncidentListRecords(
  rows: IncidentListRecord[],
  filters: IncidentListFilters,
) {
  const queryText = filters.query?.trim().toLowerCase();
  return rows
    .filter((row) =>
      filters.status === "all" ? true : row.status === filters.status,
    )
    .filter((row) =>
      filters.monitorId ? row.monitorId === filters.monitorId : true,
    )
    .filter((row) => {
      if (!queryText) {
        return true;
      }
      return [row.title, row.body ?? "", row.monitorName].some((value) =>
        value.toLowerCase().includes(queryText),
      );
    })
    .sort(compareIncidentListRecords);
}

export function compareIncidentListRecords(
  left: IncidentListRecord,
  right: IncidentListRecord,
) {
  const leftBucket = left.status === "open" ? 0 : 1;
  const rightBucket = right.status === "open" ? 0 : 1;
  if (leftBucket !== rightBucket) {
    return leftBucket - rightBucket;
  }
  return parseDateMs(right.openedAt) - parseDateMs(left.openedAt);
}
