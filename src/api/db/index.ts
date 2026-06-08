import { drizzle } from "drizzle-orm/d1";

import { DashboardReader } from "@/api/db/dashboard";
import { MonitorLifecycle } from "@/api/lib/monitor-lifecycle";

import { AuthModel } from "./models/auth";
import { IncidentModel } from "./models/incident";
import { MaintenanceModel } from "./models/maintenance";
import { MonitorModel } from "./models/monitor";
import { NotificationModel } from "./models/notification";
import { SettingsModel } from "./models/settings";
import { StatusPageModel } from "./models/status-page";
import * as schema from "./schema";

export type DbBindings = {
  DB: D1Database;
};

export function getDb(db: D1Database) {
  return drizzle(db, { schema });
}

export type AppDrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export class AppDb {
  readonly auth: AuthModel;
  readonly dashboard: DashboardReader;
  readonly incident: IncidentModel;
  readonly maintenance: MaintenanceModel;
  readonly monitor: MonitorModel;
  readonly lifecycle: MonitorLifecycle;
  readonly notification: NotificationModel;
  readonly settings: SettingsModel;
  readonly statusPage: StatusPageModel;

  constructor(readonly drizzleDb: AppDrizzleDb) {
    this.auth = new AuthModel(drizzleDb);
    this.dashboard = new DashboardReader(drizzleDb);
    this.incident = new IncidentModel(drizzleDb);
    this.maintenance = new MaintenanceModel(drizzleDb);
    this.monitor = new MonitorModel(drizzleDb);
    this.lifecycle = new MonitorLifecycle(drizzleDb);
    this.notification = new NotificationModel(drizzleDb);
    this.settings = new SettingsModel(drizzleDb);
    this.statusPage = new StatusPageModel(drizzleDb);
  }
}

export function createAppDb(dbBinding: D1Database) {
  const drizzleDb = drizzle(dbBinding, { schema });
  return new AppDb(drizzleDb);
}

export { schema };
