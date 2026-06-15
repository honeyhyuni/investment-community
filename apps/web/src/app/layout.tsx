import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// 한/영 혼용 본문 폰트. 한글+라틴을 한 패밀리로 커버한다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-sans-base",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// 숫자·가격·코드용 모노 (DESIGN.md: tabular-nums 정렬용).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "15F Investment Community",
    template: "%s | 15F",
  },
  description: "Private investment community for approved members.",
  manifest: "/manifest.json",
  applicationName: "15F",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "15F",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // 기본(라이트) 배경 토큰. 다크 토글 시 providers.tsx에서 동적으로 교체.
  themeColor: "#f7f8fb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
