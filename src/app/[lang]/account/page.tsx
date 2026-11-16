import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountView } from "@/components/AccountView";
import { isLocale } from "@/lib/i18n/locale";

export default function AccountPage(props: PageProps<"/[lang]/account">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#faf9f6]" />}>
      <Account params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Account({ params, searchParams }: Pick<PageProps<"/[lang]/account">, "params" | "searchParams">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <AccountView lang={lang} confirming={(await searchParams).logout === "1"} variant="page" />;
}
