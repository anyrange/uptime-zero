import { expect, test } from "@playwright/test";

import { fillField } from "./support/forms";

test("creates, publishes, opens, edits, and deletes a status page", async ({
  browser,
  page,
}) => {
  await page.goto("/monitors");
  if (
    !(await page
      .getByRole("link", { name: "Imported fixture monitor" })
      .count())
  ) {
    await page.getByRole("link", { name: "New monitor" }).click();
    await fillField(page, "Monitor name", "Status page monitor");
    await fillField(page, "Target", "https://example.com");
    await page.getByRole("button", { name: "Create monitor" }).click();
  }

  await page.goto("/status-pages");
  await page.getByRole("link", { name: "Create status page" }).click();
  await fillField(page, "Title", "Public E2E Status");
  await fillField(page, "Slug", "public-e2e-status");
  await page
    .getByText(/Imported fixture monitor|Status page monitor/)
    .first()
    .click();
  await page.getByRole("button", { name: "Create status page" }).click();

  await expect(page).toHaveURL(/\/status-pages$/);
  await expect(
    page.getByRole("link", { name: "Public E2E Status" }),
  ).toBeVisible();

  const publicContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const publicPage = await publicContext.newPage();
  await publicPage.goto("/status/public-e2e-status");
  await expect(
    publicPage
      .getByText(/Imported fixture monitor|Status page monitor/)
      .first(),
  ).toBeVisible();
  await publicContext.close();

  await page
    .getByRole("button", { name: "Open actions for Public E2E Status" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await fillField(page, "Title", "Public E2E Status edited");
  await page.getByText("Show recent history").click();
  await page.getByRole("button", { name: "Update status page" }).click();
  await expect(
    page.getByRole("link", { name: "Public E2E Status edited" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Open actions for Public E2E Status edited" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(
    page.getByRole("link", { name: "Public E2E Status edited" }),
  ).toHaveCount(0);
});
