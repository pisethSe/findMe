import type { Metadata } from "next";
import { Kantumruy_Pro } from "next/font/google";

import "./globals.css";
import { ExtensionHydrationGuard } from "../features/diagnostics/extension-hydration-guard";
import { SitePreferences } from "../features/preferences/site-preferences";

const kantumruy = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-kantumruy",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "rentMe | Student rentals near your university",
    template: "%s | rentMe",
  },
  description:
    "Find student-friendly rooms near universities and colleges in Phnom Penh.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={kantumruy.variable}>
        <ExtensionHydrationGuard />
        <SitePreferences>{children}</SitePreferences>
      </body>
    </html>
  );
}
