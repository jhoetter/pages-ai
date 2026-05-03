import { useQuery } from "@tanstack/react-query";
import { PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiGet } from "@/lib/api";
import { PageBreadcrumbNav, type PageBreadcrumbItem } from "@/components/PageBreadcrumbNav";

type PageRow = {
  id: string;
  title: string;
  parentPageId: string | null;
};

type PagesRes = { operations?: Array<{ payload?: { pages?: PageRow[] } }> };

export function PageEditorStickyHeader(props: {
  spaceId: string;
  pageId: string;
  /** Live title while editing (falls back to loaded page title via chain). */
  currentTitle: string;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
}) {
  const { t } = useTranslation();

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

  const ancestors = chain.length > 0 ? chain.slice(0, -1) : [];
  const untitled = t("canvas.untitled");

  const crumbLabel = (row: PageRow) => (row.title?.trim() ? row.title : untitled);
  const title =
    props.currentTitle.trim() ||
    (chain.length > 0 ? crumbLabel(chain[chain.length - 1]!) : untitled);

  const padClass = props.sidebarCollapsed ? "pl-2" : "pl-8";

  const breadcrumbItems: PageBreadcrumbItem[] = [
    { label: t("nav.pages"), to: "/pages" },
    ...ancestors.map((row) => ({ label: crumbLabel(row), to: `/pages/p/${row.id}` })),
    { label: title },
  ];

  return (
    <header
      className={`sticky top-0 z-20 flex min-h-11 shrink-0 items-center gap-2 border-b border-[var(--pa-divider)] bg-[var(--pa-bg)] pt-2 pb-3 pr-8 ${padClass}`}
    >
      {props.sidebarCollapsed ? (
        <button
          type="button"
          onClick={props.onExpandSidebar}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-1 text-[var(--pa-secondary)] transition-colors hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)]"
          aria-label={t("shell.showSidebar")}
        >
          <PanelLeft size={16} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}

      <PageBreadcrumbNav items={breadcrumbItems} />
    </header>
  );
}
