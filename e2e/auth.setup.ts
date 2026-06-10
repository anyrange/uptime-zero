import { test } from "@playwright/test";

import { setupAdmin } from "./support/auth";

test("create admin storage state", async ({ page }) => {
  await setupAdmin(page);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
