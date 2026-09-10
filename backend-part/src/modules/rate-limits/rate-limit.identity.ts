import { isIP } from "node:net";

// Express resolves trusted proxies. Never read forwarding headers directly here.
// Group IPv6 privacy addresses by /64 so rotating the host part cannot evade a
// network budget. IPv4-mapped IPv6 uses the same bucket as the IPv4 address.
export function rateLimitIp(address: string | undefined): string {
  if (!address) return "unknown";
  const unscoped = address.split("%", 1)[0] ?? "";
  if (isIP(unscoped) === 4) return unscoped;
  if (isIP(unscoped) !== 6) return "unknown";
  const canonical = new URL(`http://[${unscoped}]/`).hostname.slice(1, -1);
  const [left = "", right] = canonical.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const groups =
    right === undefined
      ? start
      : [
          ...start,
          ...Array<string>(8 - start.length - end.length).fill("0"),
          ...end,
        ];
  const parts = groups.map((part) => parseInt(part, 16));
  if (parts.slice(0, 5).every((part) => part === 0) && parts[5] === 65535) {
    const high = parts[6] ?? 0;
    const low = parts[7] ?? 0;
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return `${parts
    .slice(0, 4)
    .map((part) => part.toString(16))
    .join(":")}::/64`;
}

export function rateLimitEmail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("email" in body)) return null;
  const email = body.email;
  // This runs before DTO validation; do not coerce arbitrary objects or retain
  // oversized attacker-controlled values. Invalid bodies still use the IP budget.
  if (typeof email !== "string" || email.length > 320) return null;
  return email.trim().toLowerCase() || null;
}
