import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  user: {
    accounts: r.many.account(),
    sessions: r.many.session(),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
      optional: false,
    }),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
      optional: false,
    }),
  },
  monitors: {
    heartbeats: r.many.heartbeats(),
    heartbeatDays: r.many.heartbeatDaily(),
    incidents: r.many.incidents(),
    statusPages: r.many.statusPages({
      from: r.monitors.id.through(r.statusPageMonitors.monitorId),
      to: r.statusPages.id.through(r.statusPageMonitors.statusPageId),
    }),
    notificationDestinations: r.many.notificationDestinations({
      from: r.monitors.id.through(r.monitorNotificationDestinations.monitorId),
      to: r.notificationDestinations.id.through(
        r.monitorNotificationDestinations.notificationDestinationId,
      ),
    }),
  },
  heartbeats: {
    monitor: r.one.monitors({
      from: r.heartbeats.monitorId,
      to: r.monitors.id,
      optional: false,
    }),
  },
  heartbeatDaily: {
    monitor: r.one.monitors({
      from: r.heartbeatDaily.monitorId,
      to: r.monitors.id,
      optional: false,
    }),
  },
  incidents: {
    monitor: r.one.monitors({
      from: r.incidents.monitorId,
      to: r.monitors.id,
      optional: false,
    }),
    deliveries: r.many.notificationDeliveries(),
  },
  statusPages: {
    monitors: r.many.monitors(),
  },
  notificationDestinations: {
    monitors: r.many.monitors(),
    deliveries: r.many.notificationDeliveries(),
  },
  notificationDeliveries: {
    incident: r.one.incidents({
      from: r.notificationDeliveries.incidentId,
      to: r.incidents.id,
      optional: false,
    }),
    destination: r.one.notificationDestinations({
      from: r.notificationDeliveries.destinationId,
      to: r.notificationDestinations.id,
      optional: false,
    }),
    monitor: r.one.monitors({
      from: r.notificationDeliveries.monitorId,
      to: r.monitors.id,
      optional: false,
    }),
  },
}));
