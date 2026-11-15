import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DestDetail } from "@/components/DestDetail";
import { getDestDetail } from "@/lib/detail";
import Loading from "./loading";

export default function DestPage(props: PageProps<"/d/[slug]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Dest params={props.params} />
    </Suspense>
  );
}

async function Dest({ params }: Pick<PageProps<"/d/[slug]">, "params">) {
  const { slug } = await params;
  const dest = await getDestDetail(slug, "ja");
  if (!dest) notFound();
  return <DestDetail dest={dest} variant="page" />;
}
