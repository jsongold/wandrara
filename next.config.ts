import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 写真は Supabase Storage の dest-photos だけを最適化する。
  // 幅の種類を絞るのは Hobby の変換枠（月 5K）に収めるため：カルーセル（sizes なし の fill）は 1080 だけ、小さい写真は 256 / 640。
  // storage_key は中身の sha256 なので同じ URL の中身は変わらない。キャッシュは長く持つ。
  images: {
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/dest-photos/**`)] : [],
    deviceSizes: [1080],
    imageSizes: [256, 640],
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
