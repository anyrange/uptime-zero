import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import pkg from "./package.json" with { type: "json" };

const commitSha =
  process.env.WORKERS_CI_COMMIT_SHA ??
  process.env.COMMIT_SHA ??
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.GITHUB_SHA;

const buildInfo = {
  branch: process.env.WORKERS_CI_BRANCH ?? process.env.CF_PAGES_BRANCH ?? null,
  sha: commitSha ?? null,
  version: `${pkg.version}${commitSha ? `.${commitSha.slice(0, 8)}` : ""}`,
};

const isE2E = process.env.PLAYWRIGHT_TEST || process.env.E2E;

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      emitTsDeclarations: true,
    }),
    cloudflare({
      persistState: isE2E ? { path: ".wrangler/e2e-state" } : true,
    }),
  ],
});

export default config;
