import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, Noto_Sans_SC, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const brand = Noto_Serif_SC({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

const sans = Noto_Sans_SC({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "潮尺 — 股票分析",
  description: "手机上的股票分析：行情、K 线、均线与短线技术面速读。",
  applicationName: "潮尺",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e7f0ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${brand.variable} ${sans.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
