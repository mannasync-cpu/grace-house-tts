import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grace House Church – Devotional System",
  description: "Automated daily devotional publishing and distribution system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
