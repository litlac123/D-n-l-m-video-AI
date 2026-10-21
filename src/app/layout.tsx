import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video AI Generator - Tạo Video AI từ Ý Tưởng",
  description: "Nhập ý tưởng, nhận video AI 1 phút",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
