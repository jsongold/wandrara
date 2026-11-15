import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";
import { getCatalog, listAreas, listCategories } from "@/lib/data";
import { parseDiscoverQuery } from "@/lib/discover-query";
import { buildFeed } from "@/lib/feed";
import { loadFeedStrategies } from "@/lib/feed-config";
import { isLocale } from "@/lib/i18n/locale";
import { notFound } from "next/navigation";

export default function Home(props: PageProps<"/[lang]">) {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Discover params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Discover({ params, searchParams }: Pick<PageProps<"/[lang]">, "params" | "searchParams">) {
  const { lang: locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = parseDiscoverQuery(await searchParams);
  const catalog = await getCatalog();
  const feed = buildFeed({ catalog, query, locale }, loadFeedStrategies());
  return (
    <HomeScreen
      locale={locale}
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
