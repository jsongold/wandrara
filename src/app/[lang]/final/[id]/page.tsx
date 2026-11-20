import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FinalView } from "@/components/FinalView";
import { isLocale } from "@/lib/i18n/locale";

export default function FinalPage(props: PageProps<"/[lang]/final/[id]">) {
  return (
    <Suspense fallback={<main className="h-[100dvh] bg-[#0f0f0e]" />}>
      <Final params={props.params} />
    </Suspense>
  );
}

// ファイナル：確定した完成版。中身はこのブラウザに保存したもの（final-store）なので、画面はブラウザで読む
async function Final({ params }: Pick<PageProps<"/[lang]/final/[id]">, "params">) {
  const { lang: locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <FinalView locale={locale} id={id} />;
}
