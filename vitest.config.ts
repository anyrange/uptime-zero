import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      main: "./test/worker.ts",
      // Void generates the deployed Worker config, so the test runtime
      // declares just the bindings the server code uses.
      miniflare: {
        compatibilityDate: "2026-05-01",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        bindings: {
          BETTER_AUTH_SECRET: "test-secret-00000000000000000000000000000000",
          BETTER_AUTH_URL: "http://localhost",
          TEST_MIGRATIONS: await readD1Migrations(
            fileURLToPath(new URL("./db/migrations", import.meta.url)),
          ),
        },
      },
    })),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@schema": fileURLToPath(new URL("./db/schema.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
