import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountView } from "@/components/AccountView";
import { isLocale } from "@/lib/i18n/locale";

export default function AccountPage(props: PageProps<"/[lang]/account">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#faf9f6]" />}>
      <Account params={props.params} />
    </Suspense>
  );
}

async function Account({ params }: Pick<PageProps<"/[lang]/account">, "params">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <AccountView lang={lang} variant="page" />;
}
