// 管理の画面の入口：ログインしていなければログインへ、管理者でなければ 404
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../auth/next";
import { isAdmin } from "./items";

export async function requireAdmin(nextPath: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!isAdmin(user.id, process.env.ADMIN_USER_IDS)) notFound();
}
