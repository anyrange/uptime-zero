import { z } from "zod";

export function firstFieldError(errors: unknown[]) {
  const first = errors[0];
  const stringError = z.string().safeParse(first);
  return stringError.success
    ? stringError.data
    : first instanceof Error
      ? first.message
      : null;
}
