import type { Page } from "@playwright/test";

import { expect } from "@playwright/test";

export const adminUser = {
  name: "E2E Admin",
  email: "admin@example.test",
  password: "correct horse battery staple",
};

export async function setupAdmin(page: Page) {
  await page.goto("/setup");
  await expect(
    page.getByRole("heading", { name: "Create admin" }),
  ).toBeVisible();
  await page.getByLabel("Name").fill(adminUser.name);
  await page.getByLabel("Email").fill(adminUser.email);
  await page.getByLabel("Password").fill(adminUser.password);
  await page.getByRole("button", { name: "Create admin" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(adminUser.name)).toBeVisible();
}

export async function login(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(adminUser.email);
  await page.getByLabel("Password").fill(adminUser.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /Administrator/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
}
