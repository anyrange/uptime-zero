export function firstFieldError(errors: unknown[]) {
  const first = errors[0];
  return typeof first === "string"
    ? first
    : first instanceof Error
      ? first.message
      : null;
}
