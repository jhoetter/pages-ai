import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { apiGet } from "@/lib/api";

type SpaceRow = { id: string; name: string };
type CmdResult = { operations?: Array<{ payload?: { spaces?: SpaceRow[] } }> };
type SearchRes = { results: Array<{ id: string; title: string }> };

export function PagesHome() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";

  const { data } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => apiGet<CmdResult>("/api/spaces"),
  });
  const spaces = data?.operations?.[0]?.payload?.spaces ?? [];
  const spaceId = spaces[0]?.id ?? "unknown";

  const { data: searchData } = useQuery({
    queryKey: ["home-search", q],
    enabled: q.length > 0,
    queryFn: () => apiGet<SearchRes>(`/api/search?q=${encodeURIComponent(q)}`),
  });

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl mb-4">{t("app.title")}</h1>
      <p className="text-[var(--pa-secondary)] mb-4">{t("nav.pages")}</p>
      {q.length > 0 ? (
        <div className="mb-6">
          <p className="text-sm text-[var(--pa-secondary)] mb-2">
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
      ) : null}
      <ul className="space-y-2">
        {spaces.map((s) => (
          <li key={s.id}>
            <Link className="text-[var(--pa-accent)] hover:underline" to={`/pages/space/${s.id}`}>
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Link to={`/pages/p/new?space=${spaceId}`} className="text-[var(--pa-accent)]">
          + Page
        </Link>
      </div>
    </div>
  );
}
