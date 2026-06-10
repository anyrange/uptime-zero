import { expect, test } from "@playwright/test";

import { fieldContainer, fillField, fillNumberField } from "./support/forms";

test("updates account display name and retention settings", async ({
  page,
}) => {
  await page.goto("/settings/account");
  await fillField(page, "Name", "E2E Admin Renamed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("E2E Admin Renamed")).toBeVisible();

  await page.goto("/settings/retention");
  await fillNumberField(page, "Heartbeat retention", "15");
  await fillNumberField(page, "Closed incident retention", "45");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(
    fieldContainer(page, "Heartbeat retention").locator("input").first(),
  ).toHaveValue("15");
  await expect(
    fieldContainer(page, "Closed incident retention").locator("input").first(),
  ).toHaveValue("45");
});
