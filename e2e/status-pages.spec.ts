import { expect, test } from "@playwright/test";

import { fillField } from "./support/forms";

test("creates, publishes, opens, edits, and deletes a status page", async ({
  browser,
  page,
}) => {
  // The sidebar also lists monitors and status pages, so list lookups are
  // scoped to the table in the main content.
  const table = page.getByRole("table");

  await page.goto("/monitors");
  await page.getByRole("link", { name: "New monitor" }).click();
  await fillField(page, "Monitor name", "Status page monitor");
  await fillField(page, "URL", "https://example.com");
  await page.getByRole("button", { name: "Create monitor" }).click();
  await expect(
    table.getByRole("link", { name: "Status page monitor" }),
  ).toBeVisible();

  await page.goto("/status-pages");
  await page.getByRole("link", { name: "Create status page" }).click();
  await fillField(page, "Title", "Public E2E Status");
  await fillField(page, "Slug", "public-e2e-status");
  await page.getByRole("checkbox", { name: "Status page monitor" }).check();
  await page.getByRole("checkbox", { name: "Published" }).check();
  await page.getByRole("button", { name: "Create status page" }).click();

  await expect(page).toHaveURL(/\/status-pages$/);
  await expect(
    table.getByRole("link", { name: "Public E2E Status" }),
  ).toBeVisible();

  const publicContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });

  const publicPage = await publicContext.newPage();
  await publicPage.goto("/status/public-e2e-status");
  await expect(
    publicPage.getByText("Status page monitor").first(),
  ).toBeVisible();
  await publicContext.close();

  await page
    .getByRole("button", { name: "Open actions for Public E2E Status" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await fillField(page, "Title", "Public E2E Status edited");
  await page
    .getByRole("checkbox", { name: "Show recent history bars" })
    .click();
  await page.getByRole("button", { name: "Update status page" }).click();
  await expect(
    table.getByRole("link", { name: "Public E2E Status edited" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Open actions for Public E2E Status edited" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    table.getByRole("link", { name: "Public E2E Status edited" }),
  ).toHaveCount(0);
});
