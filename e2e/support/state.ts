import { rm } from "node:fs/promises";
import path from "node:path";

export const E2E_STATE_DIR = path.resolve(".wrangler/e2e-state");

export async function resetE2EState() {
  await rm(E2E_STATE_DIR, { force: true, recursive: true });
}
