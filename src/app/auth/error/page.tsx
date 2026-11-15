import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#171717]">
      <h1 className="text-[22px] font-bold">ログインできませんでした</h1>
      <p className="text-[13px] leading-[1.7] text-[#55524a]">リンクの有効期限が切れたか、すでに使われています。もう一度お試しください。</p>
      <Link href="/login" className="flex h-[52px] items-center rounded-[26px] bg-[#171717] px-8 text-[15px] font-medium text-white">ログインに戻る</Link>
    </main>
  );
}
