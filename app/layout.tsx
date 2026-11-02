import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { ServerLayout } from "./layout.server";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Nia",
  description: "Your personal assistant workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} m-0 min-h-screen bg-background font-sans text-foreground`}><ServerLayout>{children}</ServerLayout></body>
    </html>
  );
}
