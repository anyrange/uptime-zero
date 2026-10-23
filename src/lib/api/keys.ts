export function privateKey(...parts: ReadonlyArray<unknown>) {
  return ["private", ...parts] as const;
}
