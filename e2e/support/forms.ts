import type { Locator, Page } from "@playwright/test";

import { expect } from "@playwright/test";

export async function fillField(page: Page, label: string, value: string) {
  const accessible = page.getByLabel(label).first();
  if (await accessible.count()) {
    await replaceValue(accessible, value);
    return;
  }

  const field = page
    .locator("div", { hasText: new RegExp(`^${escapeRegExp(label)}`) })
    .filter({
      has: page.locator("input, textarea"),
    })
    .first();
  await replaceValue(field.locator("input, textarea").first(), value);
}

export async function fillNumberField(
  page: Page,
  label: string,
  value: string,
) {
  const field = fieldContainer(page, label);
  const input = field.locator("input").first();
  await replaceValue(input, value);
}

export function fieldContainer(page: Page, label: string): Locator {
  return page
    .locator("div", { hasText: new RegExp(`^${escapeRegExp(label)}`) })
    .filter({
      has: page.locator("input, textarea, button"),
    })
    .first();
}

export async function expectErrorFree(page: Page) {
  await expect(page.getByText(/^Error$/)).toHaveCount(0);
  await expect(
    page.getByText(/failed|failed to|something went wrong/i),
  ).toHaveCount(0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function replaceValue(locator: Locator, value: string) {
  await locator.click();
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await locator.fill(value);
}
