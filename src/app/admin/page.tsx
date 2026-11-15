import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CopyIdButton } from "../../components/CopyIdButton";
import { formatJst, isAdmin, listItems } from "../../lib/admin/items";
import { getCurrentUser } from "../../lib/auth/next";
import { adminClient } from "../../lib/supabase/admin";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Admin />
    </Suspense>
  );
}

async function Admin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user.id, process.env.ADMIN_USER_IDS)) notFound();

  const items = await listItems(adminClient());
  const published = items.filter((i) => i.status === "published").length;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl bg-white px-4 py-6 text-[#171717]">
      <h1 className="m-0 text-base font-semibold">管理</h1>
      <p className="my-3 text-[13px] text-[#55524a]">
        全体 {items.length}・draft {items.length - published}・published {published}
      </p>
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
                  {i.status === "published" ? <Link href={`/d/${i.slug}`} className="text-[#171717] underline">/d/{i.slug}</Link> : "-"}
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
