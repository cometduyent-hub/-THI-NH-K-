import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Physics Test Arena",
  description: "Hệ thống kiểm tra online Vật lí"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
