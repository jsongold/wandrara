import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, withLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";

export default async function AuthErrorPage(props: PageProps<"/[lang]/auth/error">) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  const m = messages(lang).login;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#171717]">
      <h1 className="text-[22px] font-bold">{m.errorTitle}</h1>
      <p className="text-[13px] leading-[1.7] text-[#55524a]">{m.errorBody}</p>
      <Link href={withLocale(lang, "/login")} className="flex h-[52px] items-center rounded-[26px] bg-[#171717] px-8 text-[15px] font-medium text-white">{m.errorBack}</Link>
    </main>
  );
}
