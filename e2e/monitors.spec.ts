import { expect, test } from "@playwright/test";

import { fillField, fillNumberField } from "./support/forms";

test("creates, edits, pauses, resumes, exports, imports, and deletes monitors", async ({
  page,
}) => {
  // The sidebar also lists monitors, so list assertions are scoped to the table.
  const monitorsTable = page.getByRole("table");

  await page.goto("/monitors");
  await page.getByRole("link", { name: "New monitor" }).click();

  await fillField(page, "Monitor name", "Example HTTP");
  await fillField(page, "URL", "https://example.com");
  await fillNumberField(page, "Timeout (ms)", "5000");
  await fillNumberField(page, "Retries", "1");
  await page.getByRole("button", { name: "Create monitor" }).click();

  await expect(page).toHaveURL(/\/monitors$/);
  await expect(
    monitorsTable.getByRole("link", { name: "Example HTTP" }),
  ).toBeVisible();

  await monitorsTable.getByRole("link", { name: "Example HTTP" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Example HTTP" }),
  ).toBeVisible();

  const monitorNavigation = page.getByRole("navigation", {
    name: "Monitor navigation",
  });

  await monitorNavigation.getByRole("link", { name: "Settings" }).click();
  await fillField(page, "Monitor name", "Example HTTP edited");
  await page.getByRole("button", { name: "Save monitor" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Example HTTP edited" }),
  ).toBeVisible();

  await monitorNavigation.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  await page.goto("/monitors");
  await page.getByLabel("Select Example HTTP edited").check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toMatch(/uptime-monitors-selected/);

  await page.getByRole("button", { name: "Delete selected" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete selected" })
    .click();
  await expect(
    monitorsTable.getByRole("link", { name: "Example HTTP edited" }),
  ).toHaveCount(0);

  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  await (await fileChooser).setFiles("e2e/fixtures/monitor-import.json");
  await expect(
    monitorsTable.getByRole("link", { name: "Imported fixture monitor" }),
  ).toBeVisible();
});
