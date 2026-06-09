import type { Database } from "@/server/db";

import { daysAgoIso, nowMs } from "@/server/lib/dates";

export class MaintenanceService {
  constructor(private readonly db: Database) {}

  async cleanupRetention() {
    const settings = await this.db.settings.get();
    await this.db.maintenance.deleteHeartbeatsBefore(
      daysAgoIso(settings.heartbeatRetentionDays),
    );
    await this.db.maintenance.deleteClosedIncidentsBefore(
      daysAgoIso(settings.incidentRetentionDays),
    );
    await this.db.maintenance.deleteExpiredSessionsBefore(nowMs());
  }
}
