# Uptime Zero

**Self-hostable uptime monitoring, built to run on Cloudflare.**

Uptime Zero is for people who want a simple monitor dashboard, public status pages, and webhook alerts without keeping a separate server around. It is inspired by [Uptime Kuma](https://github.com/louislam/uptime-kuma), but the runtime is Cloudflare Workers, D1, Durable Objects, and scheduled triggers.

It is still early, but the core idea is straightforward: create monitors, let Cloudflare run the checks, publish the health of the services you care about, and keep the operational bits small enough to self-host comfortably.

## ✨ Features

- HTTP, DNS monitors
- Scheduled checks with Cloudflare cron triggers
- Incidents created from monitor state changes
- Public status pages for sharing service health
- Webhook notifications
- Admin setup and login
- Retention settings for monitor history and closed incidents

## 🚀 Deploy

The full deployment guide is in [docs/deployment.md](docs/deployment.md).

For the short version, install dependencies, log in to Cloudflare, and create the D1 database:

```sh
pnpm install
pnpm wrangler login
pnpm wrangler d1 create uptime-zero
```

Paste the returned D1 `database_id` into `wrangler.jsonc`, then set the auth secrets and deploy:

```sh
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put BETTER_AUTH_URL
pnpm run deploy
```

After deploy, open `/setup` on your Worker URL and create the first admin account.

## 🛠️ Local Development

```sh
pnpm install
pnpm run db:migrate
pnpm run dev
```

The local Worker runs on `http://localhost:5173`

## 🧱 Stack

- Cloudflare Workers
- Cloudflare D1
- Cloudflare Durable Objects
- React 19
- TanStack Router
- Hono
- Drizzle ORM
- Better Auth
- shadcn/ui
