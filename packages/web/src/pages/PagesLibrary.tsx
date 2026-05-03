import { useQuery } from "@tanstack/react-query";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { apiGet } from "@/lib/api";
import { PageBreadcrumbNav, type PageBreadcrumbItem } from "@/components/PageBreadcrumbNav";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { loadStarredPageIds, pruneStarredPageIds, toggleStarredPageId } from "@/lib/starredPages";

type SpaceRow = { id: string; name: string };
type CmdResult = { operations?: Array<{ payload?: { spaces?: SpaceRow[] } }> };

type PageRow = {
  id: string;
  title: string;
  icon: string | null;
  parentPageId: string | null;
  sortOrder: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
};

type PagesRes = { operations?: Array<{ payload?: { pages?: PageRow[] } }> };

type LibraryTab = "all" | "recent" | "starred";

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

function isArchived(p: PageRow): boolean {
  return Boolean(p.archivedAt);
}

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

function locationLabel(
  page: PageRow,
  byId: Map<string, PageRow>,
  spaceName: string,
  untitled: string,
): string {
  const names: string[] = [];
  let pid: string | null = page.parentPageId;
  while (pid) {
    const p = byId.get(pid);
    if (!p) break;
    names.unshift(p.title?.trim() ? p.title : untitled);
    pid = p.parentPageId;
  }
  if (names.length === 0) return spaceName;
  return `${spaceName} › ${names.join(" › ")}`;
}

type LibraryRowProps = {
  page: PageRow;
  spaceName: string;
  byId: Map<string, PageRow>;
  locale: string;
  starred: boolean;
  onToggleStar: () => void;
  treeSlot: ReactNode;
  nameIndentPx: number;
  /** Nested / non-root: show breadcrumb subtitle */
  showLocationSubtitle: boolean;
};

function LibraryListRow(props: LibraryRowProps) {
  const { t } = useTranslation();
  const label = props.page.title?.trim() ? props.page.title : t("canvas.untitled");
  const edited =
    props.page.updatedAt != null ? formatRelativeTime(props.page.updatedAt, props.locale) : null;

  const locShort = locationLabel(props.page, props.byId, props.spaceName, t("canvas.untitled"));

  return (
    <div
      className="group relative flex gap-px items-start py-2 pl-2 pr-1 -mx-2 rounded-md transition-colors hover:bg-[var(--pa-hover)]/80"
      role="listitem"
    >
      <button
        type="button"
        className={`mt-1 w-7 h-7 shrink-0 flex items-center justify-center rounded-sm text-[var(--pa-tertiary)] opacity-70 hover:opacity-100 hover:bg-[var(--pa-hover)] ${
          props.starred ? "opacity-100" : ""
        }`}
        aria-pressed={props.starred}
        aria-label={
          props.starred ? t("library.starRemove", { title: label }) : t("library.starAdd", { title: label })
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onToggleStar();
        }}
      >
        <span className={`text-[14px] leading-none ${props.starred ? "text-[var(--pa-accent)]" : ""}`} aria-hidden>
          {props.starred ? "★" : "☆"}
        </span>
      </button>

      {props.treeSlot !== null ? (
        <div className="w-8 shrink-0 flex items-start justify-center pt-1">{props.treeSlot}</div>
      ) : (
        <div className="w-8 shrink-0" aria-hidden />
      )}

      <div className="min-w-0 flex-1 pt-px flex gap-4 items-start" style={{ paddingLeft: props.nameIndentPx }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              to={`/pages/p/${props.page.id}`}
              className="inline-flex items-center gap-1.5 min-w-0 text-[14px] leading-snug text-[var(--pa-fg)] hover:underline font-normal"
            >
              {props.page.icon?.trim() ? (
                <span className="text-[15px] shrink-0 leading-none" aria-hidden>
                  {props.page.icon}
                </span>
              ) : null}
              <span className="truncate">{label}</span>
            </Link>
            {edited ? (
              <time
                className="hidden sm:inline text-[12px] text-[var(--pa-tertiary)] whitespace-nowrap tabular-nums shrink-0"
                dateTime={props.page.updatedAt != null ? String(props.page.updatedAt) : undefined}
              >
                {edited}
              </time>
            ) : null}
          </div>
          {props.showLocationSubtitle ? (
            <p className="mt-1 text-[11px] leading-snug text-[var(--pa-secondary)] truncate max-w-[min(100%,48rem)]">
              {locShort}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LibraryTreeRows(props: {
  parentId: string | null;
  depth: number;
  byParent: Map<string | null, PageRow[]>;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
  spaceName: string;
  byId: Map<string, PageRow>;
  locale: string;
  starred: Set<string>;
  refreshStarred: () => void;
}) {
  const { t } = useTranslation();
  const rows = props.byParent.get(props.parentId) ?? [];

  return (
    <>
      {rows.map((page) => {
        const hasKids = (props.byParent.get(page.id)?.length ?? 0) > 0;
        const expanded = props.expanded[page.id] ?? props.depth < 1;

        const treeSlot = hasKids ? (
          <button
            type="button"
            aria-label={expanded ? t("shell.treeCollapse") : t("shell.treeExpand")}
            aria-expanded={expanded}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-sm hover:bg-[var(--pa-hover)]/90 text-[var(--pa-tertiary)]"
            onClick={() =>
              props.setExpanded((o) => ({
                ...o,
                [page.id]: !expanded,
              }))
            }
          >
            <TreeChevron expanded={expanded} />
          </button>
        ) : (
          <span className="inline-flex w-7 items-center justify-center" aria-hidden />
        );

        return (
          <Fragment key={page.id}>
            <LibraryListRow
              page={page}
              spaceName={props.spaceName}
              byId={props.byId}
              locale={props.locale}
              starred={props.starred.has(page.id)}
              onToggleStar={() => {
                toggleStarredPageId(page.id);
                props.refreshStarred();
              }}
              treeSlot={treeSlot}
              nameIndentPx={props.depth > 0 ? props.depth * 12 : 0}
              showLocationSubtitle={Boolean(page.parentPageId)}
            />
            {hasKids && expanded ? (
              <LibraryTreeRows
                parentId={page.id}
                depth={props.depth + 1}
                byParent={props.byParent}
                expanded={props.expanded}
                setExpanded={props.setExpanded}
                spaceName={props.spaceName}
                byId={props.byId}
                locale={props.locale}
                starred={props.starred}
                refreshStarred={props.refreshStarred}
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function flatTreeSpacer() {
  return <span className="inline-block w-7 shrink-0" aria-hidden />;
}

export function PagesLibrary() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language ?? "de";
  const [tab, setTab] = useState<LibraryTab>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [qInput, setQInput] = useState("");
  const [starred, setStarred] = useState(loadStarredPageIds);

  const refreshStarred = () => setStarred(loadStarredPageIds());

  const { data: spacesData, isPending: spacesPending } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => apiGet<CmdResult>("/api/spaces"),
  });
  const spaces = spacesData?.operations?.[0]?.payload?.spaces ?? [];
  const spaceId = spaces[0]?.id;
  const spaceName = spaces[0]?.name ?? "";

  const { data: pagesData, isPending: pagesPending } = useQuery({
    queryKey: ["pages-flat", spaceId],
    enabled: Boolean(spaceId),
    queryFn: () => apiGet<PagesRes>(`/api/pages?space_id=${spaceId}&all_in_space=1`),
  });

  const rawPages = pagesData?.operations?.[0]?.payload?.pages ?? [];
  const pages = useMemo(() => rawPages.filter((p) => !isArchived(p)), [rawPages]);

  useEffect(() => {
    if (!spaceId || pagesPending) return;
    const valid = new Set(pages.map((p) => p.id));
    setStarred(pruneStarredPageIds(valid));
  }, [pages, pagesPending, spaceId]);

  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p] as const)), [pages]);
  const byParent = useMemo(() => buildChildrenMap(pages), [pages]);

  const roots = byParent.get(null) ?? [];

  const sortedRecent = useMemo(() => {
    const copy = [...pages];
    copy.sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return tb - ta;
    });
    return copy;
  }, [pages]);

  const starredRows = useMemo(() => sortedRecent.filter((p) => starred.has(p.id)), [sortedRecent, starred]);

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = qInput.trim();
    if (q) navigate(`/pages?q=${encodeURIComponent(q)}`);
  };

  const tabBtn = (value: LibraryTab, labelKey: string) => (
    <button
      key={value}
      type="button"
      role="tab"
      aria-selected={tab === value}
      className={`relative pb-2.5 text-[13px] border-b-[1.5px] -mb-px transition-colors ${
        tab === value
          ? "text-[var(--pa-fg)] font-medium border-[var(--pa-fg)]"
          : "text-[var(--pa-secondary)] border-transparent hover:text-[var(--pa-fg)]"
      }`}
      onClick={() => setTab(value)}
    >
      {t(labelKey)}
    </button>
  );

  if (spacesPending || (Boolean(spaceId) && pagesPending)) {
    return (
      <div className="w-full min-w-0 max-w-none px-6 lg:px-10 xl:px-14 py-6 lg:py-10">
        <p className="text-sm text-[var(--pa-secondary)]">…</p>
      </div>
    );
  }

  if (!spaceId) {
    return (
      <p className="w-full min-w-0 px-6 lg:px-10 xl:px-14 py-6 lg:py-10 text-sm text-[var(--pa-secondary)]">
        {t("shell.noSpace")}
      </p>
    );
  }

  const newHref = `/pages/p/new?space=${encodeURIComponent(spaceId)}`;

  const tabLabelKey: "library.tabAll" | "library.tabRecent" | "library.tabStarred" =
    tab === "all" ? "library.tabAll" : tab === "recent" ? "library.tabRecent" : "library.tabStarred";
  const libraryBreadcrumbs: PageBreadcrumbItem[] = [
    { label: t("nav.pages"), to: "/pages" },
    { label: t(tabLabelKey) },
  ];

  let listMain: ReactNode;
  if (tab === "all") {
    if (roots.length === 0) {
      listMain = (
        <div className="py-16 px-4 text-center text-[13px] text-[var(--pa-secondary)]">
          <p className="mb-4">{t("shell.pagesEmpty")}</p>
          <Link to={newHref} className="text-[var(--pa-accent)] text-sm hover:underline">
            {t("shell.createFirstPage")}
          </Link>
        </div>
      );
    } else {
      listMain = (
        <div className="flex flex-col" role="list" aria-label={t("library.listAriaPages")}>
          <LibraryTreeRows
            parentId={null}
            depth={0}
            byParent={byParent}
            expanded={expanded}
            setExpanded={setExpanded}
            spaceName={spaceName}
            byId={byId}
            locale={locale}
            starred={starred}
            refreshStarred={refreshStarred}
          />
        </div>
      );
    }
  } else if (tab === "recent") {
    listMain =
      sortedRecent.length === 0 ? (
        <div className="py-16 px-4 text-center text-[13px] text-[var(--pa-secondary)]">
          {t("library.emptyRecent")}
        </div>
      ) : (
        <div className="flex flex-col" role="list" aria-label={t("library.listAriaPages")}>
          {sortedRecent.map((page) => (
            <LibraryListRow
              key={page.id}
              page={page}
              spaceName={spaceName}
              byId={byId}
              locale={locale}
              starred={starred.has(page.id)}
              onToggleStar={() => {
                toggleStarredPageId(page.id);
                refreshStarred();
              }}
              treeSlot={flatTreeSpacer()}
              nameIndentPx={0}
              showLocationSubtitle={Boolean(page.parentPageId)}
            />
          ))}
        </div>
      );
  } else if (starredRows.length === 0) {
    listMain = (
      <div className="py-16 px-4 text-center text-[13px] text-[var(--pa-secondary)]">
        {t("library.emptyStarred")}
      </div>
    );
  } else {
    listMain = (
      <div className="flex flex-col" role="list" aria-label={t("library.listAriaPages")}>
        {starredRows.map((page) => (
          <LibraryListRow
            key={page.id}
            page={page}
            spaceName={spaceName}
            byId={byId}
            locale={locale}
            starred={starred.has(page.id)}
            onToggleStar={() => {
              toggleStarredPageId(page.id);
              refreshStarred();
            }}
            treeSlot={flatTreeSpacer()}
            nameIndentPx={0}
            showLocationSubtitle={Boolean(page.parentPageId)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="w-full min-w-0 flex-1 max-w-none px-6 lg:px-10 xl:px-14 py-6 lg:pb-12 lg:pt-10"
      data-testid="pages-library"
    >
      <header className="flex flex-col gap-5 mb-10 max-w-[min(100%,80rem)]">
        <PageBreadcrumbNav items={libraryBreadcrumbs} />
        <div className="flex flex-wrap items-start justify-between gap-4 gap-y-3">
          <h1
            className="text-[28px] font-semibold text-[var(--pa-fg)] tracking-tight m-0 leading-tight"
            data-testid="pages-library-heading"
          >
            {t("nav.pages")}
          </h1>
          <Link
            data-testid="library-new-page"
            to={newHref}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-[13px] font-medium bg-[var(--pa-accent)] text-[var(--color-on-accent)] no-underline hover:opacity-90"
          >
            {t("palette.newPage")}
          </Link>
        </div>

        <nav
          className="flex flex-wrap gap-6 border-b border-[var(--pa-divider)]"
          aria-label={t("library.tabsAria")}
        >
          {tabBtn("all", "library.tabAll")}
          {tabBtn("recent", "library.tabRecent")}
          {tabBtn("starred", "library.tabStarred")}
        </nav>

        <form
          onSubmit={onSearchSubmit}
          className="flex flex-wrap items-center gap-2 w-full max-w-[min(100%,36rem)]"
        >
          <input
            type="search"
            value={qInput}
            autoComplete="off"
            aria-label={t("palette.searchPages")}
            placeholder={t("library.searchPlaceholder")}
            className="flex-1 min-w-[140px] text-[13px] py-2 px-0 bg-transparent border-0 border-b border-[var(--pa-divider)] text-[var(--pa-fg)] placeholder:text-[var(--pa-tertiary)] outline-none focus:border-[var(--pa-accent)]/50 transition-colors"
            onChange={(e) => setQInput(e.target.value)}
          />
          <button
            type="submit"
            className="text-[12px] text-[var(--pa-secondary)] hover:text-[var(--pa-fg)] px-2 py-1 rounded-sm hover:bg-[var(--pa-hover)]"
          >
            {t("library.runSearch")}
          </button>
        </form>
        <p className="text-[11px] text-[var(--pa-secondary)] leading-relaxed m-0 max-w-[min(100%,36rem)]">
          {t("library.searchHint")}
        </p>
      </header>

      <section className="max-w-[min(100%,80rem)]" aria-label={t("nav.pages")}>
        {listMain}
      </section>
    </div>
  );
}
