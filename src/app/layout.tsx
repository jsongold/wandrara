import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "WANDRARA",
  description: "箱根・伊豆の場所と体験を、写真から見つける。",
};

// sheet：トップから開いた詳細を重ねるスロット（app/@sheet）
export default function RootLayout({ children, sheet }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {sheet}
      </body>
    </html>
  );
}
