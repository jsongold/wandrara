import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginPanel } from "@/components/LoginPanel";
import { getCurrentUser, safeNextPath } from "@/lib/auth/next";
import { isLocale } from "@/lib/i18n/locale";

export default function LoginPage(props: PageProps<"/[lang]/login">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#24231f]" />}>
      <Login params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Login({ params, searchParams }: Pick<PageProps<"/[lang]/login">, "params" | "searchParams">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);
  if (await getCurrentUser()) redirect(next);
  return <LoginPanel locale={lang} next={next} />;
}
