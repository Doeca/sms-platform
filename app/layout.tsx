import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-info";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Private SMS aggregation inbox"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
