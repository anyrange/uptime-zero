# Uptime Zero

Self-hostable uptime monitoring on the Cloudflare free tier.

Uptime Zero is a small monitoring app for people who want something like [Uptime Kuma](https://github.com/louislam/uptime-kuma), but built for Cloudflare Workers instead of a server you have to keep around.

It handles the practical parts first: HTTP, keyword, JSON, DNS, and push checks; incidents; public status pages; webhooks; and admin settings. The app runs on Workers with D1, Durable Objects, and scheduled triggers, so one person can deploy it and keep it running without a separate VM.

## Features

- Monitor CRUD for HTTP, keyword, JSON, DNS, and push monitors
- Scheduled checks through Cloudflare cron triggers
- Incident tracking from monitor state changes
- Public status pages
- Webhook notifications
- Admin setup and login
- Retention settings for monitor history and closed incidents

## Stack

- Cloudflare Workers
- Cloudflare D1
- Cloudflare Durable Objects
- React 19
- TanStack Router
- Hono
- Drizzle ORM
- Better Auth
- shadcn/ui

## Deploy

See [docs/deployment.md](docs/deployment.md).

Short version:

```sh
pnpm install
pnpm wrangler login
pnpm wrangler d1 create uptime-zero
```

Paste the returned D1 `database_id` into `wrangler.jsonc`, then set auth config and deploy:

```sh
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put BETTER_AUTH_URL
pnpm run deploy
```

After deploy, open `/setup` on your Worker URL and create the first admin account.

## Local Development

```sh
pnpm install
pnpm run db:migrate
pnpm run dev:worker
```

For the Vite frontend dev server:

```sh
pnpm run dev
```

## Project Status

This is early self-hostable software. The core monitoring flow works, and the roadmap stays intentionally close to practical uptime monitoring: better notifications, richer incident management, maintenance windows, and a few more monitor types. See [docs/roadmap.md](docs/roadmap.md).
