import { createAuthClient } from "better-auth/react";

/** Talks to the Better Auth handler mounted at `/api/auth/*`. */
export const authClient = createAuthClient();

/** Better Auth reports failures as values; mutations need thrown errors. */
export async function unwrapAuthResult<
  T extends { error: { message?: string } | null },
>(request: Promise<T>) {
  const result = await request;

  if (result.error) throw new Error(result.error.message ?? "Request failed");

  return result;
}
