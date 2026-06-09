import { defineConfig } from "void/config";

export default defineConfig({
  worker: {
    compatibility_date: "2026-05-01",
    compatibility_flags: ["nodejs_compat"],
  },
  cloudflare: {
    name: "uptime-zero-demo",
    account_id: "4f1f6a74f0f1faee4a93162736f7cb05",
    // Dashboard-managed routing, pinned so `void deploy` can republish it.
    workers_dev: true,
    preview_urls: true,
    observability: {
      enabled: true,
      head_sampling_rate: 1,
      logs: { head_sampling_rate: 1, invocation_logs: false },
      traces: { head_sampling_rate: 1 },
    },
    d1_databases: [
      {
        binding: "DB",
        database_id: "f97ea3da-9701-40e5-b92d-9d52e3c30b93",
        database_name: "uptime-zero-demo",
        migrations_dir: "./db/migrations",
      },
    ],
    // Deployed Workers carry this Durable Object history; never reorder or drop steps.
    // v5 retires the scheduler and outbox actors that Void crons replaced.
    migrations: [
      { tag: "v1", new_sqlite_classes: ["MonitorActor"] },
      { tag: "v2", new_sqlite_classes: ["SchedulerActor"] },
      { tag: "v3", deleted_classes: ["MonitorActor"] },
      { tag: "v4", new_sqlite_classes: ["NotificationActor"] },
      {
        tag: "v5",
        deleted_classes: ["SchedulerActor", "NotificationActor"],
      },
    ],
  },
});
