import type { SVGProps } from "react";

type IconName =
  | "pin"
  | "search"
  | "filter"
  | "sun"
  | "moon"
  | "chevron"
  | "arrow"
  | "close"
  | "bed"
  | "floor"
  | "area"
  | "pause"
  | "play"
  | "menu"
  | "globe"
  | "check";
const paths: Record<IconName, string> = {
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  filter: "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z",
  chevron: "m7 10 5 5 5-5",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  close: "m6 6 12 12M6 18 18 6",
  bed: "M3 19V6m0 9h18v4M3 10h5a3 3 0 0 1 3 3v2m0-6h7a3 3 0 0 1 3 3v3",
  floor: "m12 3 10 6-10 6L2 9 12 3ZM2 14l10 6 10-6",
  area: "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M8 12h8m-4-4v8",
  pause: "M9 5v14M15 5v14",
  play: "m8 4 12 8-12 8V4Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z",
  check: "m5 12 4 4L19 6",
};
export function LandingIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
export type LandingLocale = "en" | "km";
export const translate = (locale: LandingLocale, en: string, km: string) =>
  locale === "km" ? km : en;
