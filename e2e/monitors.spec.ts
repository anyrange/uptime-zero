import { expect, test } from "@playwright/test";

import { fillField, fillNumberField } from "./support/forms";

test("creates, edits, pauses, resumes, exports, imports, and deletes monitors", async ({
  page,
}) => {
  await page.goto("/monitors");
  await page.getByRole("link", { name: "New monitor" }).click();

  await fillField(page, "Monitor name", "Example HTTP");
  await fillField(page, "Target", "https://example.com");
  await fillNumberField(page, "Interval (sec, minimum 60)", "60");
  await fillNumberField(page, "Timeout (ms)", "5000");
  await fillNumberField(page, "Retries", "1");
  await page.getByRole("button", { name: "Create monitor" }).click();

  await expect(page).toHaveURL(/\/monitors$/);
  await expect(page.getByRole("link", { name: "Example HTTP" })).toBeVisible();

  await page.getByRole("link", { name: "Example HTTP" }).click();
  await expect(
    page.getByRole("heading", { name: "Example HTTP" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Settings" }).click();
  await fillField(page, "Monitor name", "Example HTTP edited");
  await page.getByRole("button", { name: "Save monitor" }).click();
  await expect(
    page.getByRole("heading", { name: "Example HTTP edited" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Settings" }).click();
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
  await page.getByRole("button", { name: "Delete selected" }).click();
  await expect(
    page.getByRole("link", { name: "Example HTTP edited" }),
  ).toHaveCount(0);

  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  await (await fileChooser).setFiles("e2e/fixtures/monitor-import.json");
  await expect(
    page.getByRole("link", { name: "Imported fixture monitor" }),
  ).toBeVisible();
});
