import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobPrepped Marketplace MVP",
  description: "Marketplace-style hiring dashboard for workers and employers powered by Firebase"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
