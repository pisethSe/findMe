/**
 * Joins conditional class names.
 *
 * The product ships plain CSS Modules instead of a utility framework, so this
 * stays a tiny local helper rather than adding a class-merging dependency.
 */
export type ClassValue =
  string | number | null | undefined | false | readonly ClassValue[];

export function cn(...inputs: readonly ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input && input !== 0) continue;
    if (Array.isArray(input)) {
      const nested = cn(...(input as readonly ClassValue[]));
      if (nested) classes.push(nested);
      continue;
    }
    classes.push(String(input));
  }
  return classes.join(" ");
}
