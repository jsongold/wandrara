// 管理者だけが見る、下書きを含む dest のプレビュー。公開ページと同じ表示を、シークレットキーで読んで出す
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DestDetail } from "../../../../components/DestDetail";
import { requireAdmin } from "../../../../lib/admin/guard";
import { loadDestDetail } from "../../../../lib/detail";
import { adminClient } from "../../../../lib/supabase/admin";
import Loading from "../../../d/[slug]/loading";

export default function AdminPreviewPage(props: PageProps<"/admin/d/[slug]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Preview params={props.params} />
    </Suspense>
  );
}

async function Preview({ params }: Pick<PageProps<"/admin/d/[slug]">, "params">) {
  const { slug } = await params;
  await requireAdmin(`/admin/d/${slug}`);
  const dest = await loadDestDetail(adminClient(), process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", slug, "ja");
  if (!dest) notFound();
  return (
    <>
      <p className="m-0 bg-[#171717] px-4 py-2 text-center text-[12px] text-white">プレビュー（下書きを含む。公開ページではない）</p>
      <DestDetail dest={dest} variant="page" />
    </>
  );
}
