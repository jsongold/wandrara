import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BfcacheGuard } from "@/components/BfcacheGuard";
import { DebugOverlay } from "@/components/DebugOverlay";
import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/lib/i18n/locale";
import "../globals.css";

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

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// sheet：トップから開いた詳細を重ねるスロット（app/[lang]/@sheet）。lang は URL の先頭の言語
export default async function RootLayout({ children, sheet, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {sheet}
        <BfcacheGuard />
        <DebugOverlay />
      </body>
    </html>
  );
}
