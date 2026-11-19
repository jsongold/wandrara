// next.config.ts の images（deviceSizes / imageSizes）と各画面の sizes から、ブラウザへ出す srcset の幅を確かめる。
// 幅の種類は Hobby の変換枠（月 5K）に直結する（キーは 画像 × 幅 × 画質 × 形式）。幅を足すときはここを直して見積もりを見直す。
import { getImgProps } from "next/dist/shared/lib/get-img-props";
import { imageConfigDefault, prepareImageConfig } from "next/dist/shared/lib/image-config";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

const imgConf = prepareImageConfig({ ...imageConfigDefault, ...nextConfig.images } as typeof imageConfigDefault);
const src = "https://example.supabase.co/storage/v1/object/public/dest-photos/a.jpg";

function widths(props: Record<string, unknown>): number[] {
  const { props: out } = getImgProps(
    { src, alt: "", ...props } as Parameters<typeof getImgProps>[0],
    { defaultLoader: ({ src: s, width }) => `${s}?w=${width}`, imgConf, blurComplete: false, showAltText: false },
  );
  // 候補は「URL 幅w」（sizes あり）か「URL 1x / 2x」（sizes なし）。どちらも URL の w= を読む
  return (out.srcSet ?? "").split(",").map((p) => Number(/w=(\d+)/.exec(p)![1]));
}

describe("画像の幅（srcset）", () => {
  it("カルーセル（fill・100vw）は 828 / 1080 だけ", () => {
    expect(widths({ fill: true, sizes: "(max-width: 480px) 100vw, 480px" })).toEqual([828, 1080]);
  });

  it("関連タイル（38vw）は 384 / 480 を使い、640 は出さない", () => {
    const w = widths({ width: 640, height: 640, sizes: "(max-width: 480px) 38vw, 182px" });
    expect(w).toContain(384);
    expect(w).toContain(480);
    expect(w).not.toContain(640);
  });

  it("部屋（複数枚 78vw）は 1080 を最初の候補にしない", () => {
    expect(widths({ width: 1080, height: 720, sizes: "(max-width: 480px) 78vw, 374px" })[0]).toBe(828);
  });

  it("保存一覧（64px・sizes なし）は 256 だけ", () => {
    expect(new Set(widths({ width: 64, height: 64 }))).toEqual(new Set([256]));
  });
});
