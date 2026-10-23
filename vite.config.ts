import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { voidPlugin } from "void";

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
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      emitTsDeclarations: true,
    }),
    // Void runs Start inside the Workers runtime (local D1 and the rate
    // limiter included) and must precede the framework plugin. E2E runs keep
    // their own local state so they never touch development data.
    voidPlugin({ persistTo: isE2E ? ".void/e2e-state" : undefined }),
    // Start must precede the React plugin.
    tanstackStart(),
    react(),
  ],
});

export default config;
