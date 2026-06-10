import { expect, test } from "@playwright/test";

import { adminUser, login, logout } from "./support/auth";

test("logout, invalid login, and valid login behavior", async ({ page }) => {
  await page.goto("/");
  await logout(page);

  await page.getByLabel("Email").fill(adminUser.email);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText(/401 Unauthorized|invalid|incorrect|failed/i),
  ).toBeVisible();

  await page.getByLabel("Password").fill(adminUser.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  await logout(page);
  await login(page);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
