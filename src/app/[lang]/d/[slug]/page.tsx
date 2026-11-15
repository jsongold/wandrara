import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DestDetail } from "@/components/DestDetail";
import { getDestDetail } from "@/lib/detail";
import { isLocale } from "@/lib/i18n/locale";
import Loading from "./loading";

export default function DestPage(props: PageProps<"/[lang]/d/[slug]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Dest params={props.params} />
    </Suspense>
  );
}

async function Dest({ params }: Pick<PageProps<"/[lang]/d/[slug]">, "params">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const dest = await getDestDetail(slug, lang);
  if (!dest) notFound();
  return <DestDetail dest={dest} variant="page" locale={lang} />;
}
