import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "就活スケジュール管理",
  description: "就職活動インターンシップ管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <nav className="border-b bg-card shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-3 py-2 sm:px-4 sm:py-0 sm:h-14 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            <Link href="/" className="font-bold text-base sm:text-lg tracking-tight whitespace-nowrap self-start sm:self-auto">
              就活スケジュール管理
            </Link>
            <div className="grid w-full grid-cols-4 gap-1 sm:flex sm:w-auto sm:items-center">
              <Link
                href="/"
                className="px-1 sm:px-3 py-1.5 rounded-md text-center text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
              >
                ダッシュボード
              </Link>
              <Link
                href="/calendar"
                className="px-1 sm:px-3 py-1.5 rounded-md text-center text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
              >
                カレンダー
              </Link>
              <Link
                href="/companies"
                className="px-1 sm:px-3 py-1.5 rounded-md text-center text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
              >
                企業一覧
              </Link>
              <Link
                href="/settings"
                className="px-1 sm:px-3 py-1.5 rounded-md text-center text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
              >
                設定
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-screen-2xl mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
