import { execFileSync } from "node:child_process";

/**
 * Applies `db/migrations` to the e2e database. Playwright starts the dev
 * server before global setup, and the dev server records `.void/e2e-state`
 * as Void's local database, so `void db migrate` targets it rather than
 * the development data.
 */
export default function migrate() {
  execFileSync("pnpm", ["void", "db", "migrate"], { stdio: "inherit" });
}
