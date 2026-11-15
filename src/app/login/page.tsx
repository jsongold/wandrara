import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginPanel } from "../../components/LoginPanel";
import { getCurrentUser, safeNextPath } from "../../lib/auth/next";

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#24231f]" />}>
      <Login searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);
  if (await getCurrentUser()) redirect(next);
  return <LoginPanel next={next} />;
}
