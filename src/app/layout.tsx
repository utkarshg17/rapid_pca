import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rapid PCA",
  description: "Construction field-to-office data platform",
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