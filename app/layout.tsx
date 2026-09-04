import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Physics Test Arena",
  description: "Hệ thống kiểm tra trực tuyến môn Vật lí",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
