import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { apiGet } from "@/lib/api";

type PageRow = {
  id: string;
  title: string;
  parentPageId: string | null;
};

type PagesRes = { operations?: Array<{ payload?: { pages?: PageRow[] } }> };

export function PageBreadcrumbs(props: { spaceId: string; pageId: string }) {
  const { data } = useQuery({
    queryKey: ["pages-flat", props.spaceId],
    enabled: Boolean(props.spaceId),
    queryFn: () =>
      apiGet<PagesRes>(`/api/pages?space_id=${props.spaceId}&all_in_space=1`),
  });
  const pages = data?.operations?.[0]?.payload?.pages ?? [];
  const byId = new Map(pages.map((p) => [p.id, p] as const));

  const chain: PageRow[] = [];
  let cur: string | null = props.pageId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const p = byId.get(cur);
    if (!p) break;
    chain.push(p);
    cur = p.parentPageId;
  }
  chain.reverse();

  if (chain.length === 0) return null;

  return (
    <nav
      className="text-xs text-[var(--pa-tertiary)] mb-3 flex flex-wrap gap-x-1 gap-y-0.5 items-center"
      aria-label="Breadcrumb"
    >
      {chain.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1 min-w-0">
          {i > 0 ? <span className="text-[var(--pa-divider)]">/</span> : null}
          {i === chain.length - 1 ? (
            <span className="truncate text-[var(--pa-secondary)]">{c.title || "…"}</span>
          ) : (
            <Link
              to={`/pages/p/${c.id}`}
              className="truncate hover:text-[var(--pa-accent)] no-underline"
            >
              {c.title || "…"}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
