import type { Metadata } from "next";
import { WorkspaceLayout } from "./workspace-layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nia",
  description: "Your personal assistant workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><WorkspaceLayout>{children}</WorkspaceLayout></body>
    </html>
  );
}
