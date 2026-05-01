# Deployment

Uptime Zero deploys as a Cloudflare Worker with static assets, D1, Durable Objects, and a scheduled trigger.

## Requirements

- Node.js
- pnpm
- A Cloudflare account with Workers enabled

## 1. Install dependencies

```sh
pnpm install
```

## 2. Log in to Cloudflare

```sh
pnpm wrangler login
```

If you manage more than one Cloudflare account, set the right account in your Wrangler profile or add your own `account_id` to `wrangler.jsonc`.

## 3. Create a D1 database

```sh
pnpm wrangler d1 create uptime-zero
```

Copy the returned `database_id` into the `d1_databases` section of `wrangler.jsonc`.

## 4. Set auth secrets

Generate a strong secret:

```sh
openssl rand -base64 32
```

Set it in Cloudflare:

```sh
pnpm wrangler secret put BETTER_AUTH_SECRET
```

Set the public Worker URL used by auth cookies and redirects:

```sh
pnpm wrangler secret put BETTER_AUTH_URL
```

Use your final origin, for example `https://uptime.example.com` or the `workers.dev` URL.

## 5. Deploy

```sh
pnpm run deploy
```

The deploy script applies remote D1 migrations, builds the app, and deploys the generated Worker bundle.

## 6. Create the first admin

Open:

```txt
https://your-domain.example/setup
```

Create the first admin account. After an admin exists, setup redirects to the app.

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

## Local Worker

Apply local migrations and run Wrangler dev:

```sh
pnpm run db:migrate
pnpm run dev:worker
```

The local Worker runs on `http://localhost:8788`.
