import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useParams } from "react-router";
import { apiGet } from "@/lib/api";

function TreeChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className={`shrink-0 text-[var(--pa-tertiary)] transition-transform duration-150 ${
        expanded ? "" : "-rotate-90"
      }`}
      aria-hidden
    >
      <path
        d="M4 5.5L7 8.5L10 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type SpaceRow = { id: string; name: string };
type SpacesRes = { operations?: Array<{ payload?: { spaces?: SpaceRow[] } }> };
type PageRow = {
  id: string;
  title: string;
  parentPageId: string | null;
  icon: string | null;
  sortOrder: number;
};
type PagesRes = { operations?: Array<{ payload?: { pages?: PageRow[] } }> };

function buildChildrenMap(pages: PageRow[]): Map<string | null, PageRow[]> {
  const m = new Map<string | null, PageRow[]>();
  for (const p of pages) {
    const k = p.parentPageId;
    const arr = m.get(k) ?? [];
    arr.push(p);
    m.set(k, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return m;
}

function TreeBranch(props: {
  parentId: string | null;
  byParent: Map<string | null, PageRow[]>;
  depth: number;
}) {
  const { pageId: activePageId } = useParams();
  const rows = props.byParent.get(props.parentId) ?? [];
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <ul className={`list-none m-0 p-0 ${props.depth > 0 ? "pl-2 border-l border-[var(--pa-divider)] ml-1" : ""}`}>
      {rows.map((p) => {
        const hasKids = (props.byParent.get(p.id)?.length ?? 0) > 0;
        const expanded = open[p.id] ?? props.depth < 1;
        return (
          <li key={p.id} className="my-0.5">
            <div className="flex items-center gap-0.5 min-w-0">
              {hasKids ? (
                <button
                  type="button"
                  aria-label="toggle"
                  className="w-6 h-7 shrink-0 flex items-center justify-center rounded-md hover:bg-[var(--pa-hover)]"
                  onClick={() => setOpen((o) => ({ ...o, [p.id]: !expanded }))}
                >
                  <TreeChevron expanded={expanded} />
                </button>
              ) : (
                <span className="w-6 shrink-0 inline-block" />
              )}
              <NavLink
                to={`/pages/p/${p.id}`}
                className={({ isActive }) =>
                  `flex-1 truncate rounded-md px-2 py-1.5 text-[13px] min-w-0 transition-colors ${
                    isActive || activePageId === p.id
                      ? "bg-[var(--pa-hover)] font-medium text-[var(--pa-fg)]"
                      : "text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)]"
                  }`
                }
              >
                <span className="mr-1">{p.icon ?? "📄"}</span>
                {p.title || "…"}
              </NavLink>
            </div>
            {hasKids && expanded ? (
              <TreeBranch parentId={p.id} byParent={props.byParent} depth={props.depth + 1} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function PageTree() {
  const { t } = useTranslation();
  const { data: spacesData } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => apiGet<SpacesRes>("/api/spaces"),
  });
  const spaces = spacesData?.operations?.[0]?.payload?.spaces ?? [];
  const spaceId = spaces[0]?.id;

  const { data: pagesData } = useQuery({
    queryKey: ["pages-flat", spaceId],
    enabled: Boolean(spaceId),
    queryFn: () =>
      apiGet<PagesRes>(`/api/pages?space_id=${spaceId}&all_in_space=1`),
  });
  const pages = pagesData?.operations?.[0]?.payload?.pages ?? [];
  const byParent = useMemo(() => buildChildrenMap(pages), [pages]);

  if (!spaceId) {
    return <p className="text-xs text-[var(--pa-tertiary)] px-2">{t("shell.noSpace")}</p>;
  }

  const roots = byParent.get(null) ?? [];

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2 min-h-0" aria-label={t("nav.pages")}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pa-tertiary)] px-2 mb-2">
        {spaces[0]?.name ?? t("app.title")}
      </div>
      <Link
        to={`/pages/p/new?space=${encodeURIComponent(spaceId)}`}
        className="mb-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)] no-underline transition-colors"
      >
        <span className="text-base leading-none opacity-80">+</span>
        {t("shell.newPage")}
      </Link>
      {roots.length === 0 ? (
        <div className="px-2 py-4 rounded-lg border border-dashed text-center" style={{ borderColor: "var(--pa-divider)" }}>
          <p className="text-xs text-[var(--pa-tertiary)] mb-2 leading-relaxed">{t("shell.pagesEmpty")}</p>
          <Link
            to={`/pages/p/new?space=${encodeURIComponent(spaceId)}`}
            className="text-xs font-medium text-[var(--pa-accent)] hover:underline"
          >
            {t("shell.createFirstPage")}
          </Link>
        </div>
      ) : (
        <TreeBranch parentId={null} byParent={byParent} depth={0} />
      )}
    </nav>
  );
}
