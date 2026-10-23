import "@tanstack/react-start/server-only";
import { notFound } from "@tanstack/react-router";

import * as repo from "./accounts.repository";

/**
 * Account use cases. Sign-up, sign-in and profile edits go through Better
 * Auth's handler; this module covers what the app reads and resets itself.
 */

/** Whether the installation's single admin has been created yet. */
export async function hasAdmin() {
  return (await repo.countUsers()) > 0;
}

export async function find(userId: string) {
  const account = await repo.findAccount(userId);

  if (!account) throw notFound();

  return account;
}

/** Deletes the admin with every monitor, page and destination. */
export const deleteWorkspace = repo.deleteWithWorkspace;
