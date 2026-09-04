import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CHINH PHỤC KHTN CÙNG THẦY TUẤN",
  description: "Hệ thống kiểm tra online KHTN"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return (
    <html lang="vi">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body);"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
