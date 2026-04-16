import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

// Caveat — a natural, legible handwriting face used for the rendered ink.
// Exposed as a CSS variable so PageSurface can reference it without worrying
// about font-loading timing.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Morning Pages",
  description:
    "A writing app that simulates the physical experience of handwriting on paper.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${caveat.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
