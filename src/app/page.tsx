import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { getCatalog, listAreas, listCategories } from "@/lib/data";
import { parseDiscoverQuery } from "@/lib/discover-query";
import { buildFeed } from "@/lib/feed";
import { loadFeedStrategies } from "@/lib/feed-config";

export default function Home(props: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Discover searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Discover({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const query = parseDiscoverQuery(await searchParams);
  const locale = "ja" as const;
  const catalog = await getCatalog();
  const feed = buildFeed({ catalog, query, locale }, loadFeedStrategies());
  return (
    <HomeScreen
      query={query}
      feed={feed}
      categories={listCategories(catalog, query.mode, locale)}
      areas={listAreas(catalog, locale)}
    />
  );
}

function HomeFallback() {
  return (
    <main className="flex h-[100dvh] items-center justify-center bg-[#0f0f0e] text-white">
      <span className="text-[15px] font-semibold tracking-[0.24em]">WANDRARA</span>
    </main>
  );
}
