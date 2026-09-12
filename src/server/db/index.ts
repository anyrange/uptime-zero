import { drizzle } from "drizzle-orm/d1";

import { CheckModel } from "./models/check";
import { IncidentModel } from "./models/incident";
import { MaintenanceModel } from "./models/maintenance";
import { MonitorModel } from "./models/monitor";
import { NotificationModel } from "./models/notification";
import { SettingsModel } from "./models/settings";
import { StatusPageModel } from "./models/status-page";
import { UserModel } from "./models/user";
import { relations } from "./relations";
import * as schema from "./schema";

export function getDrizzle(db: D1Database) {
  return drizzle(db, { relations });
}

export type DrizzleDatabase = ReturnType<typeof getDrizzle>;

export class Database {
  readonly check: CheckModel;
  readonly incident: IncidentModel;
  readonly maintenance: MaintenanceModel;
  readonly monitor: MonitorModel;
  readonly notification: NotificationModel;
  readonly settings: SettingsModel;
  readonly statusPage: StatusPageModel;
  readonly user: UserModel;

  constructor(readonly drizzle: DrizzleDatabase) {
    this.check = new CheckModel(drizzle);
    this.incident = new IncidentModel(drizzle);
    this.maintenance = new MaintenanceModel(drizzle);
    this.monitor = new MonitorModel(drizzle);
    this.notification = new NotificationModel(drizzle);
    this.settings = new SettingsModel(drizzle);
    this.statusPage = new StatusPageModel(drizzle);
    this.user = new UserModel(drizzle);
  }
}

export function createDatabase(d1Binding: D1Database) {
  const db = getDrizzle(d1Binding);

  return new Database(db);
}

export { schema };
