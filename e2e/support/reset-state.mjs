import { rm } from "node:fs/promises";
import path from "node:path";

const stateDir = path.resolve(".wrangler/e2e-state");

await rm(stateDir, { force: true, recursive: true });
