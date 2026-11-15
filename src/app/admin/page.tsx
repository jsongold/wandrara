import Link from "next/link";
import { Suspense } from "react";
import { CopyIdButton } from "../../components/CopyIdButton";
import { requireAdmin } from "../../lib/admin/guard";
import { formatJst, listItems } from "../../lib/admin/items";
import { adminClient } from "../../lib/supabase/admin";

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Admin searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Admin({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdmin("/admin");

  const raw = (await searchParams).page;
  const { items, total, published, page, pageCount } = await listItems(adminClient(), Number(Array.isArray(raw) ? raw[0] : raw) || 1);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl bg-white px-4 py-6 text-[#171717]">
      <h1 className="m-0 text-base font-semibold">管理</h1>
      <div className="my-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#55524a]">
        <p className="m-0">
          全体 {total}・draft {total - published}・published {published}
        </p>
        <Pager page={page} pageCount={pageCount} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[#d6d3cb]">
        <table className="w-full min-w-[800px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#d6d3cb] text-[#55524a]">
              {["名前", "種類", "ref", "状態", "最終更新", "投入したキー", "リンク", ""].map((h, n) => (
                <th key={n} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.destId} className="border-b border-[#eeece6] last:border-0">
                <td className="px-3 py-2">{i.name}</td>
                <td className="px-3 py-2">{i.typeLabel}</td>
                <td className="px-3 py-2">{i.ref ?? "-"}</td>
                <td className="px-3 py-2">{i.status}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatJst(i.updatedAt)}</td>
                <td className="px-3 py-2">{i.keyName}</td>
                <td className="px-3 py-2">
                  {i.status === "published" ? (
                    <Link href={`/d/${i.slug}`} className="text-[#171717] underline">/d/{i.slug}</Link>
                  ) : (
                    <Link href={`/admin/d/${i.slug}`} className="text-[#171717] underline">プレビュー</Link>
                  )}
                </td>
                <td className="px-3 py-2"><CopyIdButton value={i.ref ?? i.slug} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pager({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const link = (p: number, label: string) =>
    p >= 1 && p <= pageCount ? (
      <Link href={`/admin?page=${p}`} className="text-[#171717] underline">{label}</Link>
    ) : (
      <span className="text-[#b5b2aa]">{label}</span>
    );
  return (
    <p className="m-0 flex gap-3">
      {link(page - 1, "前へ")}
      <span>
        {page} / {pageCount}
      </span>
      {link(page + 1, "次へ")}
    </p>
  );
}
