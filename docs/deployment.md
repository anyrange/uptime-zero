# Deployment

Uptime Zero deploys as a Cloudflare Worker with static assets, D1, Durable Objects, and a scheduled trigger.

## Requirements

- Node.js
- pnpm
- A Cloudflare account

## Deploy

```sh
# 1. Install dependencies.
pnpm install

# 2. Log in and confirm the target account.
pnpm wrangler login
pnpm wrangler whoami

# 3. If `whoami` shows multiple accounts, add the target account_id to wrangler.jsonc.
#    Keep the D1 binding name as DB.

# 4. Create the remote D1 database and copy the returned database_id into wrangler.jsonc.
pnpm wrangler d1 create uptime-zero

# 5. Set auth secrets.
openssl rand -base64 32
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put BETTER_AUTH_URL

# 6. Apply remote migrations, build, and deploy.
pnpm run deploy
```

Use your final public origin for `BETTER_AUTH_URL`, for example `https://uptime.example.com`.
If you do not know the `workers.dev` origin yet, deploy once, copy the URL printed by Wrangler, update `BETTER_AUTH_URL`, and deploy again:

```sh
pnpm wrangler secret put BETTER_AUTH_URL
pnpm wrangler deploy --config dist/uptime_zero/wrangler.json
```

Open the setup page and create the first admin:

```txt
https://your-domain.example/setup
```

After an admin exists, setup redirects to the app.

## Notes

- `pnpm run deploy` builds the app, applies remote D1 migrations, and deploys the generated Worker bundle.
- Wrangler D1 commands use the account selected by `wrangler.jsonc`; on multi-account logins, add `account_id` before creating or listing D1 databases.
- Keep the D1 binding as `DB`. Wrangler may suggest a binding based on the database name, but the app expects `env.DB`.
- `workers.dev` may be enabled by default if `workers_dev` is omitted from `wrangler.jsonc`.

## Custom Domain

Add a custom domain or route from the Cloudflare Workers dashboard after the first deploy. Then update `BETTER_AUTH_URL` to the new origin:

```sh
pnpm wrangler secret put BETTER_AUTH_URL
pnpm run deploy
```

## Updating

Pull the latest code, install dependencies, and deploy again:

```sh
pnpm install
pnpm run deploy
```

If new migrations exist, `pnpm run deploy` applies them before deploying.

## Monitoring reliability

Checks use the installation scheduler's Durable Object alarm. A separate Durable Object delivers notifications from a D1 outbox, with per-destination exponential retries capped at one hour. Delivery is at least once: a provider may receive a duplicate if its request succeeds but the acknowledgement cannot be saved. Webhook receivers should deduplicate by monitor, status, and checkedAt.

A one-minute Cron Trigger repairs missing scheduler and notification wakeups. The daily trigger cleans retained data. This design targets small self-hosted installations; checks run in batches of two, so large numbers of slow monitors can delay later checks. Public status responses aggregate checks in D1 and refresh every 30 seconds.

## Upgrading from versions that exposed heartbeat tokens

After deploying this update, rotate the token for each heartbeat monitor that appeared on a published status page. In the monitor settings, choose **Rotate heartbeat token**, then update the sending job with its new URL. Existing URLs are retained until you rotate them to avoid stopping jobs without their replacement URL being configured.

The schema enforces one administrator per installation. If an earlier setup race created multiple administrators, resolve those accounts before applying the migration. The migration fails on duplicates rather than silently removing accounts.
