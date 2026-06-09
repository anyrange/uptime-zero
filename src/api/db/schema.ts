import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  role: text("role").default("user"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdx: index("session_user_idx").on(table.userId),
  }),
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    idToken: text("idToken"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    providerAccountIdx: index("account_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
    userIdx: index("account_user_idx").on(table.userId),
  }),
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const monitors = sqliteTable("monitors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  target: text("target").notNull(),
  intervalSec: integer("intervalSec").notNull(),
  timeoutMs: integer("timeoutMs").notNull(),
  retries: integer("retries").notNull(),
  assertionsJson: text("assertionsJson"),
  heartbeatMode: text("heartbeatMode").notNull().default("interval"),
  heartbeatCron: text("heartbeatCron"),
  heartbeatGraceSec: integer("heartbeatGraceSec"),
  heartbeatTimezone: text("heartbeatTimezone"),
  notificationGraceSec: integer("notificationGraceSec").notNull().default(0),
  pushToken: text("pushToken").unique(),
  active: integer("active").notNull().default(1),
  lastStatus: text("lastStatus").notNull().default("unknown"),
  lastCheckedAt: text("lastCheckedAt"),
  lastDurationMs: integer("lastDurationMs"),
  lastError: text("lastError"),
  lastDownNotifiedAt: text("lastDownNotifiedAt"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const heartbeats = sqliteTable(
  "heartbeats",
  {
    id: text("id").primaryKey(),
    monitorId: text("monitorId")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    statusCode: integer("statusCode"),
    durationMs: integer("durationMs"),
    error: text("error"),
    createdAt: text("createdAt").notNull(),
    source: text("source").notNull(),
  },
  (table) => ({
    createdIdx: index("heartbeats_created_idx").on(table.createdAt),
    monitorCreatedIdx: index("heartbeats_monitor_created_idx").on(
      table.monitorId,
      table.createdAt,
    ),
  }),
);

export const incidents = sqliteTable(
  "incidents",
  {
    id: text("id").primaryKey(),
    monitorId: text("monitorId")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status").notNull(),
    body: text("body"),
    pinned: integer("pinned").notNull().default(0),
    openedAt: text("openedAt").notNull(),
    closedAt: text("closedAt"),
  },
  (table) => ({
    statusOpenedIdx: index("incidents_status_opened_idx").on(
      table.status,
      table.openedAt,
    ),
  }),
);

export const statusPages = sqliteTable("statusPages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  published: integer("published").notNull().default(1),
  showHistory: integer("showHistory").notNull().default(1),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const statusPageMonitors = sqliteTable(
  "statusPageMonitors",
  {
    statusPageId: text("statusPageId")
      .notNull()
      .references(() => statusPages.id, { onDelete: "cascade" }),
    monitorId: text("monitorId")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.statusPageId, table.monitorId] }),
  }),
);

export const notificationDestinations = sqliteTable(
  "notificationDestinations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    configJson: text("configJson").notNull(),
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => ({
    providerCreatedIdx: index(
      "notification_destinations_provider_created_idx",
    ).on(table.provider, table.createdAt),
  }),
);

export const monitorNotificationDestinations = sqliteTable(
  "monitorNotificationDestinations",
  {
    monitorId: text("monitorId")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    notificationDestinationId: text("notificationDestinationId")
      .notNull()
      .references(() => notificationDestinations.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.monitorId, table.notificationDestinationId],
    }),
  }),
);

export const appSettings = sqliteTable("appSettings", {
  id: text("id").primaryKey(),
  heartbeatRetentionDays: integer("heartbeatRetentionDays")
    .notNull()
    .default(30),
  incidentRetentionDays: integer("incidentRetentionDays").notNull().default(90),
  updatedAt: text("updatedAt").notNull(),
});
