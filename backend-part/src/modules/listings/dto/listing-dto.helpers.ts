export function trimRequired({ value }: { value: unknown }): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export function trimOptional({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
