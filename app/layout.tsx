import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meeting Governance — live",
  description: "Real-time meeting governance: decide what gets recorded before it's written down.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
