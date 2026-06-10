import { expect, test } from "@playwright/test";

import { fillField } from "./support/forms";

test("creates, edits, test-sends, and deletes a webhook notifier", async ({
  page,
}) => {
  await page.goto("/notifications");
  await page
    .locator("div", { hasText: /^Webhook/ })
    .filter({ has: page.getByRole("button", { name: "Add" }) })
    .first()
    .getByRole("button", { name: "Add" })
    .click();

  await fillField(page, "Name", "E2E webhook");
  await fillField(page, "Endpoint URL", "https://example.com/webhook");
  await page.getByRole("button", { name: "Add header" }).click();
  await page.getByPlaceholder("X-Token").fill("X-E2E");
  await page.getByPlaceholder("secret").fill("secret");
  await page.getByRole("button", { name: "Create new notifier" }).click();

  await expect(page.getByText("E2E webhook")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).first().click();
  await fillField(page, "Name", "E2E webhook edited");
  await page.getByRole("button", { name: "Save notifier" }).click();
  await expect(page.getByText("E2E webhook edited")).toBeVisible();

  await page.getByRole("button", { name: "Test" }).first().click();
  await expect(page.getByText("E2E webhook edited")).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByText("E2E webhook edited")).toHaveCount(0);
});
