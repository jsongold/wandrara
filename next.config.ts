import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 写真は Supabase Storage の dest-photos だけを最適化する。
  // 幅の種類を絞るのは Hobby の変換枠（月 5K。キーは 画像 × 幅 × 画質 × 形式）に収めるため。
  // カルーセル・部屋（sizes あり）は deviceSizes から、タイル（sizes 38vw）は imageSizes の 384 / 480 から選ぶ。
  //   390px 幅の DPR2 → カルーセル 828・タイル 384、DPR3 → カルーセル 1080・タイル 480。保存一覧（64px）は 256。
  // storage_key は中身の sha256 なので同じ URL の中身は変わらない。キャッシュは長く持つ。
  images: {
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/dest-photos/**`)] : [],
    deviceSizes: [828, 1080],
    imageSizes: [256, 384, 480],
    qualities: [75],
    minimumCacheTTL: 2678400, // 31 日
  },
  partialPrefetching: true,
  async redirects() {
    return [{ source: "/spots/:id", destination: "/d/:id", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
