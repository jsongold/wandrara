import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SpotDetail } from "@/components/SpotDetail";
import { getSpotDetail } from "@/lib/data";
import Loading from "./loading";

export default function SpotPage(props: PageProps<"/spots/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Spot params={props.params} />
    </Suspense>
  );
}

async function Spot({ params }: Pick<PageProps<"/spots/[id]">, "params">) {
  const { id } = await params;
  const spot = await getSpotDetail(id, "ja");
  if (!spot) notFound();
  return <SpotDetail spot={spot} variant="page" />;
}
