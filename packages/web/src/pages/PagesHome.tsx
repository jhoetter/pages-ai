import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { apiGet } from "@/lib/api";
import { PagesLibrary } from "@/pages/PagesLibrary";

type SearchRes = { results: Array<{ id: string; title: string }> };

function PagesSearchResults({ q }: { q: string }) {
  const { t } = useTranslation();

  const { data: searchData } = useQuery({
    queryKey: ["home-search", q],
    queryFn: () => apiGet<SearchRes>(`/api/search?q=${encodeURIComponent(q)}`),
  });

  return (
    <div className="p-6 max-w-3xl">
      <p className="text-sm text-[var(--pa-secondary)] mb-4">
        {t("palette.searchResults")}: “{q}”
      </p>
      <ul className="space-y-2">
        {(searchData?.results ?? []).map((r) => (
          <li key={r.id}>
            <Link className="text-[var(--pa-accent)] hover:underline" to={`/pages/p/${r.id}`}>
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PagesHome() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";

  if (q.length > 0) {
    return <PagesSearchResults q={q} />;
  }

  return <PagesLibrary />;
}
