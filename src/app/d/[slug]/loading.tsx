export default function Loading() {
  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[480px] bg-[#f7f6f2]" aria-busy="true" aria-label="読み込み中">
      <div className="h-[420px] animate-pulse bg-[#dcd9d0] motion-reduce:animate-none" />
      <div className="flex flex-col gap-3 px-5 pt-5">
        <div className="h-4 w-16 rounded bg-[#e8e5dc]" />
        <div className="h-7 w-3/4 rounded bg-[#e8e5dc]" />
        <div className="h-4 w-1/3 rounded bg-[#e8e5dc]" />
      </div>
    </main>
  );
}
