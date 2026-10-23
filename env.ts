import { defineEnv, string, url } from "void/env";

// Server secrets. Local values live in `.env`; production values are set with
// `pnpm void secret put <NAME>`.
export default defineEnv({
  // Signs sessions; generate one with `openssl rand -hex 32`.
  BETTER_AUTH_SECRET: string(),
  // Public origin of the deployed app. Optional: same-origin requests are
  // trusted either way, so local dev and previews work without it.
  BETTER_AUTH_URL: url().optional(),
});
