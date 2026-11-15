// 概要の下の「IN 15:00 — OUT 10:00」。時刻が無いときは --:-- を薄く出す
const KEY = "text-[9.5px] font-bold tracking-[.08em] text-[#8a867c]";

function Time({ value }: { value: string | null }) {
  return (
    <b className={`text-[13px] font-semibold tabular-nums ${value ? "text-[#141413]" : "text-[#b5b0a5]"}`}>{value ?? "--:--"}</b>
  );
}

export function StayStrip({ checkIn, checkOut }: { checkIn: string | null; checkOut: string | null }) {
  return (
    <div className="inline-flex items-center gap-1.5 self-start rounded-[99px] bg-[#efece4] px-[11px] py-[5px] leading-none">
      <span className={KEY}>IN</span>
      <Time value={checkIn} />
      <span aria-hidden className="mx-0.5 h-px w-3.5 bg-[#b9b4a8]" />
      <span className={KEY}>OUT</span>
      <Time value={checkOut} />
    </div>
  );
}
