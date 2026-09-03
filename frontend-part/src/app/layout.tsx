import type { Metadata } from "next";
import { Kantumruy_Pro } from "next/font/google";

import "./globals.css";

const kantumruy = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-kantumruy",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FindMe | Student rentals near your university",
    template: "%s | FindMe",
  },
  description:
    "Find student-friendly rooms near universities and colleges in Phnom Penh.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="km">
      <body className={kantumruy.variable}>{children}</body>
    </html>
  );
}
