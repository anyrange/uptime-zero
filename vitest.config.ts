import type { D1Migration } from "@cloudflare/vitest-pool-workers";

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrationsPath = path.join(
        import.meta.dirname,
        "drizzle/migrations",
      );
      const migrations = await readNestedD1Migrations(migrationsPath);

      return {
        main: "./src/server/index.ts",
        wrangler: {
          configPath: "./wrangler.jsonc",
        },
        miniflare: {
          bindings: {
            BETTER_AUTH_SECRET: "test-secret-00000000000000000000000000000000",
            BETTER_AUTH_URL: "http://localhost",
            TEST_MIGRATIONS: migrations,
          },
        },
      };
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

async function readNestedD1Migrations(
  migrationsPath: string,
): Promise<D1Migration[]> {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const migrationDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    migrationDirs.map(async (name) => {
      const sql = await readFile(
        path.join(migrationsPath, name, "migration.sql"),
        "utf8",
      );

      return {
        name,
        queries: sql
          .split("--> statement-breakpoint")
          .map((query) => query.trim())
          .filter(Boolean),
      };
    }),
  );
}
