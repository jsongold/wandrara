// Agent が仕上げた完成版（グループに送る文）を読む（純関数）。
// 形は WANDRARA の下書きと同じ（見出し・「■ 役割：名前（種類・エリア）」・「・」の箇条・最後に「要確認：」）。崩れていても、読めた所だけ返す
export type FinalLink = { label: string; url: string };
export type FinalPlace = { role: string; title: string; bookings: FinalLink[]; lines: string[] };
export type ParsedFinal = { heading: string; places: FinalPlace[]; checks: string[] };

const URL_RE = /https?:\/\/[^\s）)」]+/;

/** 「■ 泊まる：koti hakone（一棟貸し・箱根・仙石原）」→ 役割と名前 */
function placeHead(line: string): { role: string; title: string } | null {
  const m = /^■\s*([^：:]+)[：:]\s*(.+?)\s*(?:[（(][^（）()]*[）)])?\s*$/.exec(line);
  return m ? { role: m[1].trim(), title: m[2].trim() } : null;
}

/** 予約の行：「・予約（楽天トラベル） https://…」「・Book (Rakuten) https://…」。bookWords は言語ごとの「予約」 */
function bookingOf(line: string, bookWords: string[]): FinalLink | null {
  const body = line.replace(/^[・\-*]\s*/, "");
  if (!bookWords.some((w) => body.startsWith(w))) return null;
  const url = URL_RE.exec(body)?.[0];
  if (!url) return null;
  const label = /[（(]([^）)]+)[）)]/.exec(body)?.[1]?.trim() ?? "";
  return { label, url };
}

export function parseFinal(text: string, bookWords: string[] = ["予約", "Book"], checkWords: string[] = ["要確認", "To check"]): ParsedFinal {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
  const heading = lines.find((l) => l && !l.startsWith("■")) ?? "";
  const places: FinalPlace[] = [];
  const checks: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (checkWords.some((w) => line.startsWith(w))) {
      checks.push(line.replace(/^[^：:]+[：:]\s*/, ""));
      continue;
    }
    const head = placeHead(line);
    if (head) {
      places.push({ ...head, bookings: [], lines: [] });
      continue;
    }
    const cur = places.at(-1);
    if (!cur) continue;
    const b = bookingOf(line, bookWords);
    if (b) cur.bookings.push(b);
    cur.lines.push(line);
  }
  return { heading, places, checks };
}

/** 取り込んだ文が完成版として使えるか（場所が 1 つ以上読めた） */
export const isUsableFinal = (p: ParsedFinal): boolean => p.places.length > 0;
