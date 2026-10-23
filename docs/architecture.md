# Architecture

Uptime Zero is one TanStack Start app deployed with [Void](https://void.cloud). It follows Void's [project structure](https://void.cloud/reference/structure) and [type pipeline](https://void.cloud/guide/type-safety): the Drizzle schema is the source of truth, types are inferred from it through queries and server functions, and inputs are validated with Standard Schema (zod) at the server-function boundary.

```txt
db/
  schema.ts                       Drizzle tables (`void/schema-d1`); `@schema` in code
  migrations/                     SQL written by `void db generate`; `pnpm db:migrate` locally, applied on deploy
crons/                            Void cron entrypoints; thin calls into src/modules
env.ts                            Typed environment (`void/env`)
src/
  modules/<feature>/              Server-only feature code
    <feature>.repository.ts       Drizzle queries for the feature's tables
    <feature>.service.ts          Use cases and rules; the only thing transports call
    *.ts                          Feature helpers (probe, schedule, metrics, providers, …)
  modules/auth/better-auth.ts     Better Auth over `void/db`
  lib/schemas/<feature>.ts        Client-safe zod schemas (inputs, JSON column shapes) and types
  lib/api/<feature>.ts            Server functions (createServerFn) with their queryOptions and mutation hooks
  lib/api/middleware.ts           Session and permission middleware for server functions
  lib/api/error-middleware.ts     Logs and masks unexpected server-function errors
  lib/errors.ts                   `AppError`: an expected failure with a translated message
  lib/permissions.ts              Role → capability table shared by middleware and UI
  routes/api/                     Raw HTTP endpoints (Better Auth handler, push heartbeats)
  routes/, components/, lib/      The frontend
  start.ts                        Registers `errorMiddleware` for every server function
```

## Rules

- **Server-only.** Every file under `src/modules/` starts with `import "@tanstack/react-start/server-only"`, so Start's import protection fails the build if client code reaches it. UI code imports `src/lib/*` (schemas, API modules) and never `src/modules/*`. API modules may import services because Start compiles `createServerFn` handlers out of the client bundle.
- **Database.** Query with `db` from `void/db` and tables from `@schema` (`import * as schema from "@schema"`). Writes that must commit together use `db.batch([...])` (one atomic D1 batch; D1 has no interactive transactions). Schema changes go through `pnpm db:generate` (`void db generate`); never hand-write migration SQL.
- **Types.** Row types come from Drizzle (`typeof schema.monitors.$inferSelect`) and return types are inferred; the UI reads them from server functions (`Awaited<ReturnType<typeof getMonitor>>`). Text columns with a fixed set of values declare `{ enum: [...] }` in the schema so their literal types flow through. Write zod schemas only for inputs and for JSON stored in text columns.
- **Repositories** own SQL and return plain rows or `null` for a missing row. **Services** apply the rules, call repositories and other services (`import * as incidents from "@/modules/incidents/incidents.service"`), and throw on expected failures. **Server functions** authenticate, authorize (`permissionMiddleware`), validate input (`.validator(Schema)`), and call a service. They never touch `db`.
- **Time** comes from `dayjs()` (stored as ISO strings), which reads `Date`, so tests freeze it with fake timers. **Outbound HTTP** goes through the global `fetch`, which tests stub.
- **Logging** uses `logger` from `void/log` (one JSON line per entry, indexed by Workers Logs).

## Errors

- A missing resource throws the router's `notFound()`, which renders the route's not-found UI.
- An expected failure throws `AppError` with a translated message (`m.*`); the client shows it as is.
- Anything else is an internal failure. `errorMiddleware` logs it with its stack and sends the client a generic message.

## Scheduling

Void's framework mode can't host Durable Objects or queue producers, so a per-minute cron (`crons/monitor-checks.ts`) is the scheduler: it asks the monitors service for overdue monitors and runs each check. A check result is recorded with its incident transition and notification intents in one batch, gated on the monitor still being active at the revision the check ran against, so overlapping runs and concurrent edits are safe. A second cron drains the notification outbox with per-intent backoff, and a daily cron applies retention.

## Adding a feature

1. Tables in `db/schema.ts`, then `pnpm db:generate`.
2. `src/lib/schemas/<feature>.ts`: zod input schemas with translated messages.
3. `src/modules/<feature>/<feature>.repository.ts` and `<feature>.service.ts`, both marked `server-only`.
4. `src/lib/api/<feature>.ts`: server functions with permission middleware and a validator, then the `queryOptions` and mutation hooks that call them.
