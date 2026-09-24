import type { Metadata } from "next";
import { Kantumruy_Pro } from "next/font/google";

import "./globals.css";
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
    <html lang="en" data-scroll-behavior="smooth">
      <body className={kantumruy.variable}>
        <SitePreferences>{children}</SitePreferences>
      </body>
    </html>
  );
}
