import english from "./en.json" with { type: "json" };
import khmer from "./km.json" with { type: "json" };

export const KHMER_MESSAGES: Readonly<Record<string, string>> = khmer;

export function translateMessage(text: string, locale: "en" | "km"): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const branded = normalized.replaceAll("FindMe", "rentMe");
  if (locale === "en")
    return (
      (english as Readonly<Record<string, string>>)[normalized] ??
      text.replaceAll("FindMe", "rentMe")
    );
  const translated = KHMER_MESSAGES[normalized] ?? KHMER_MESSAGES[branded];
  if (translated !== undefined) {
    return `${/^\s/.test(text) ? " " : ""}${translated.trim()}${/\s$/.test(text) ? " " : ""}`;
  }
  // Dynamic copy keeps names, money, distances and identifiers intact.
  const patterns: ReadonlyArray<readonly [RegExp, string]> = [
    [/^Within (.+) km$/, "ក្នុងរង្វង់ $1 គម"],
    [/^(.+) km from (.+)$/, "$1 គម ពី $2"],
    [/^Available from (.+)$/, "ទំនេរចាប់ពី $1"],
    [/^Rooms near (.+)$/, "បន្ទប់នៅជិត $1"],
    [/^Page (\d+) of (\d+)$/, "ទំព័រ $1 នៃ $2"],
    [/^(.+) rentals found$/, "រកឃើញបន្ទប់ $1"],
    [/^(.+) rooms available$/, "បន្ទប់ទំនេរ $1"],
  ];
  for (const [pattern, replacement] of patterns)
    if (pattern.test(normalized))
      return normalized.replace(pattern, replacement);
  return text;
}
