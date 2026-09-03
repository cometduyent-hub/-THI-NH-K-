import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CHINH PHỤC KHTN CÙNG THẦY TUẤN",
  description: "Hệ thống kiểm tra online KHTN"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
