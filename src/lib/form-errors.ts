import { z } from "zod";

/**
 * TanStack Form collects whatever validators return: Standard Schema issues
 * (`{ message }`), plain strings, or thrown errors. Fields show the first one.
 */
const FieldError = z.union([
  z.string(),
  z.object({ message: z.string() }).transform((issue) => issue.message),
]);

export function firstFieldError(errors: ReadonlyArray<unknown>) {
  return FieldError.safeParse(errors[0]).data ?? null;
}

/** The first issue of a failed parse, which hand-rolled forms show inline. */
export function firstSchemaErrorMessage(error: z.ZodError) {
  return error.issues[0]?.message;
}
