# Deployment

Uptime Zero deploys to your Cloudflare account with [Void](https://void.cloud): a single Worker serving the TanStack Start app, a D1 database, and cron triggers.

## Requirements

- Node.js
- pnpm
- A Cloudflare account

## Deploy

```sh
# 1. Install dependencies.
pnpm install

# 2. Set the auth secrets (validated against `env.ts`).
openssl rand -base64 32
pnpm void secret put BETTER_AUTH_SECRET
pnpm void secret put BETTER_AUTH_URL

# 3. Build, provision missing resources, apply D1 migrations, and deploy.
pnpm run deploy
```

The first `pnpm run deploy` (`void deploy`) signs you in to Cloudflare, asks which account to use, creates the D1 database, and records its ID in `void.lock.json`. Commit `void.config.ts` and `void.lock.json` after the first deploy.

Use your final public origin for `BETTER_AUTH_URL`, for example `https://uptime.example.com`. If you don't know the `workers.dev` origin yet, deploy once, then set `BETTER_AUTH_URL` to the printed URL and deploy again.

Open the setup page and create the first admin:

```txt
https://your-domain.example/setup
```

After an admin exists, setup redirects to the app.

## Notes

- Keep the D1 binding as `DB`; the app reads `env.DB`.
- Migrations are flat `<tag>.sql` files that `pnpm db:generate` (`void db generate`) writes into `db/migrations/` from `db/schema.ts`. `void deploy` applies pending ones remotely through the `migrations_dir` in `void.config.ts`; `pnpm db:migrate` (`void db migrate`) applies them to the local database used by `pnpm dev`.
- Use `pnpm void project status`, `pnpm void project logs`, and `pnpm void project rollback` to inspect and roll back deployments. Rollback does not reverse database migrations.

## Moving an existing Wrangler deployment to Void

Installs deployed with Wrangler before this version keep their Worker and D1 data:

1. Put the existing D1 `database_id` on the `DB` binding in `void.config.ts` (`cloudflare.d1_databases`), so Void reuses the database instead of creating a new one.
2. Existing databases recorded their migrations as `<tag>/migration.sql`, while Void names them `<tag>.sql`. Rename the recorded entries so Void doesn't apply them again:

   ```sh
   pnpm void db execute --remote "UPDATE d1_migrations SET name = replace(name, '/migration.sql', '.sql')"
   ```

3. Run `pnpm run deploy` and accept linking the existing `uptime-zero` Worker.

The deploy retires the scheduler and notification Durable Objects (Durable Object migration `v5`). If Cloudflare can't stage that change, deploy once with `pnpm void deploy --platform cloudflare --atomic`.

## Custom Domain

Add a custom domain with `pnpm void domain add <hostname>`, or a route in the Cloudflare dashboard. Then update `BETTER_AUTH_URL` to the new origin and redeploy:

```sh
pnpm void secret put BETTER_AUTH_URL
pnpm run deploy
```

## Updating

Pull the latest code, install dependencies, and deploy again:

```sh
pnpm install
pnpm run deploy
```

New migrations are applied as part of the deploy.

## Monitoring reliability

A one-minute cron runs every due check, earliest first, five at a time, and sends the alerts those checks committed. A check therefore starts within about a minute of becoming due. Up to 20 checks run per minute, so a single invocation stays inside the Workers Free subrequest budget; any extra due monitors run first on the next minute. A check that cannot be saved is retried after 30 seconds, on the next cron run.

Every check result is committed in one D1 batch together with its incident change and notification intents. A result is discarded if the monitor was edited, paused or deleted while the check ran, so overlapping runs never double-count.

A second one-minute cron delivers due notifications from the D1 outbox, with per-destination exponential retries capped at one hour. Push heartbeats and a new monitor's first check send their alerts right away. Delivery is at least once: a provider may receive a duplicate if its request succeeds but the acknowledgement cannot be saved. Webhook receivers should deduplicate by monitor, status, and checkedAt.

A daily cron cleans retained data. Public status responses aggregate checks in D1 and refresh every 30 seconds.

## Upgrading from versions that exposed heartbeat tokens

After deploying this update, rotate the token for each heartbeat monitor that appeared on a published status page. In the monitor settings, choose **Rotate heartbeat token**, then update the sending job with its new URL. Existing URLs are retained until you rotate them to avoid stopping jobs without their replacement URL being configured.

The schema enforces one administrator per installation. If an earlier setup race created multiple administrators, resolve those accounts before applying the migration. The migration fails on duplicates rather than silently removing accounts.
