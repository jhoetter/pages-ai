import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { PagePickerList } from "@/components/PagePickerList";
import { PopoverPortal } from "@/components/PopoverPortal";
import { apiGet, apiPost } from "@/lib/api";
import { loadStarredPageIds, pruneStarredPageIds, toggleStarredPageId } from "@/lib/starredPages";

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
  archivedAt?: string | Date | null;
};
type PagesRes = { operations?: Array<{ payload?: { pages?: PageRow[] } }> };

function isArchived(p: PageRow): boolean {
  return Boolean(p.archivedAt);
}

function buildChildrenMap(pages: PageRow[]): Map<string | null, PageRow[]> {
  const m = new Map<string | null, PageRow[]>();
  for (const p of pages) {
    if (isArchived(p)) continue;
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

/** `pageId` and all descendants — invalid targets when moving `pageId` under another page. */
function idsInSubtree(pageId: string, byParent: Map<string | null, PageRow[]>): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    out.push(id);
    for (const c of byParent.get(id) ?? []) walk(c.id);
  };
  walk(pageId);
  return out;
}

function TreeBranch(props: {
  parentId: string | null;
  byParent: Map<string | null, PageRow[]>;
  depth: number;
  spaceId: string;
  starred: Set<string>;
  onToggleStar: (pageId: string) => void;
  renamingPageId: string | null;
  renameDraft: string;
  onRenameDraftChange: (v: string) => void;
  onRenameCommit: (pageId: string) => void;
  onRenameCancel: () => void;
  onOpenMenu: (pageId: string, anchor: HTMLElement) => void;
  openMenuPageId: string | null;
}) {
  const { t } = useTranslation();
  const { pageId: activePageId } = useParams();
  const rows = props.byParent.get(props.parentId) ?? [];
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const indentClass =
    props.depth > 0 ? "ml-1.5 pl-2 border-l border-[var(--pa-divider)]/45" : "";

  return (
    <ul className={`list-none m-0 p-0 ${indentClass}`}>
      {rows.map((p) => {
        const hasKids = (props.byParent.get(p.id)?.length ?? 0) > 0;
        const expanded = open[p.id] ?? props.depth < 1;
        const label = p.title?.trim() ? p.title : t("canvas.untitled");
        const showIcon = Boolean(p.icon?.trim());
        const isRenaming = props.renamingPageId === p.id;
        const starred = props.starred.has(p.id);

        return (
          <li key={p.id} className="my-px">
            <div className="group/tree-row flex min-w-0 items-center gap-px rounded-sm hover:bg-[var(--pa-hover)]/80">
              {hasKids ? (
                <button
                  type="button"
                  aria-label={expanded ? t("shell.treeCollapse") : t("shell.treeExpand")}
                  aria-expanded={expanded}
                  className="flex h-[26px] w-[22px] shrink-0 items-center justify-center rounded-sm text-[var(--pa-tertiary)] hover:bg-[var(--pa-hover)]"
                  onClick={() => setOpen((o) => ({ ...o, [p.id]: !expanded }))}
                >
                  <TreeChevron expanded={expanded} />
                </button>
              ) : (
                <span className="inline-block w-[22px] shrink-0" aria-hidden />
              )}
              {isRenaming ? (
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded-sm border border-[var(--pa-divider)] bg-[var(--pa-bg)] px-1.5 py-[5px] text-[13px] leading-snug text-[var(--pa-fg)] outline-none focus:ring-2 focus:ring-[var(--pa-accent)]/30"
                  value={props.renameDraft}
                  onChange={(e) => props.onRenameDraftChange(e.target.value)}
                  onBlur={() => props.onRenameCommit(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      props.onRenameCancel();
                    }
                  }}
                />
              ) : (
                <NavLink
                  to={`/pages/p/${p.id}`}
                  title={label}
                  className={({ isActive }) =>
                    [
                      "flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1.5 py-[5px] text-[13px] leading-snug no-underline transition-colors",
                      isActive || activePageId === p.id
                        ? "bg-[var(--pa-hover)] font-medium text-[var(--pa-fg)]"
                        : "text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)]",
                    ].join(" ")
                  }
                >
                  {showIcon ? (
                    <span className="shrink-0 select-none text-[15px] leading-none" aria-hidden>
                      {p.icon}
                    </span>
                  ) : null}
                  <span className="truncate">{label}</span>
                </NavLink>
              )}
              {!isRenaming ? (
                <>
                  <button
                    type="button"
                    className={`pointer-events-none flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-sm text-[var(--pa-tertiary)] opacity-0 transition-opacity group-hover/tree-row:pointer-events-auto group-hover/tree-row:opacity-100 group-focus-within/tree-row:pointer-events-auto group-focus-within/tree-row:opacity-100 ${
                      starred ? "pointer-events-auto opacity-100" : ""
                    }`}
                    aria-pressed={starred}
                    aria-label={
                      starred ? t("library.starRemove", { title: label }) : t("library.starAdd", { title: label })
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      props.onToggleStar(p.id);
                    }}
                  >
                    <span
                      className={`text-[14px] leading-none ${starred ? "text-[var(--pa-accent)]" : ""}`}
                      aria-hidden
                    >
                      {starred ? "★" : "☆"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pointer-events-none flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-sm text-[var(--pa-tertiary)] opacity-0 transition-opacity hover:bg-[var(--pa-hover)] hover:text-[var(--pa-secondary)] group-hover/tree-row:pointer-events-auto group-hover/tree-row:opacity-100 group-focus-within/tree-row:pointer-events-auto group-focus-within/tree-row:opacity-100"
                    aria-label={t("shell.sidebarMoreActions")}
                    aria-haspopup="menu"
                    aria-expanded={props.openMenuPageId === p.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      props.onOpenMenu(p.id, e.currentTarget);
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </>
              ) : (
                <span className="w-[52px] shrink-0" aria-hidden />
              )}
            </div>
            {hasKids && expanded ? (
              <TreeBranch
                parentId={p.id}
                byParent={props.byParent}
                depth={props.depth + 1}
                spaceId={props.spaceId}
                starred={props.starred}
                onToggleStar={props.onToggleStar}
                renamingPageId={props.renamingPageId}
                renameDraft={props.renameDraft}
                onRenameDraftChange={props.onRenameDraftChange}
                onRenameCommit={props.onRenameCommit}
                onRenameCancel={props.onRenameCancel}
                onOpenMenu={props.onOpenMenu}
                openMenuPageId={props.openMenuPageId}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function PageTree() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { pageId: routePageId } = useParams();
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const [starred, setStarred] = useState(loadStarredPageIds);
  const [menuPageId, setMenuPageId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [movingPageId, setMovingPageId] = useState<string | null>(null);
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const { data: spacesData } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => apiGet<SpacesRes>("/api/spaces"),
  });
  const spaces = spacesData?.operations?.[0]?.payload?.spaces ?? [];
  const spaceId = spaces[0]?.id;

  const { data: pagesData } = useQuery({
    queryKey: ["pages-flat", spaceId],
    enabled: Boolean(spaceId),
    queryFn: () => apiGet<PagesRes>(`/api/pages?space_id=${spaceId}&all_in_space=1`),
  });
  const pages = pagesData?.operations?.[0]?.payload?.pages ?? [];
  const byParent = useMemo(() => buildChildrenMap(pages), [pages]);

  useEffect(() => {
    const valid = new Set(pages.filter((p) => !isArchived(p)).map((p) => p.id));
    setStarred(pruneStarredPageIds(valid));
  }, [pages]);

  const closeMenu = useCallback(() => {
    setMenuPageId(null);
    setMenuAnchorEl(null);
  }, []);

  useEffect(() => {
    if (!menuPageId || !menuAnchorEl) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (menuPanelRef.current?.contains(node)) return;
      if (menuAnchorEl.contains(node)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuPageId, menuAnchorEl, closeMenu]);

  const postCommand = async (body: { type: string; payload: Record<string, unknown> }) => {
    await apiPost("/api/commands", {
      ...body,
      actor_id: "web",
      actor_type: "human",
    });
    void qc.invalidateQueries({ queryKey: ["pages-flat"] });
    void qc.invalidateQueries({ queryKey: ["page"] });
  };

  const menuTarget = useMemo(() => pages.find((p) => p.id === menuPageId) ?? null, [pages, menuPageId]);

  const moveExcludeIds = useMemo(() => {
    if (!movingPageId) return [];
    return idsInSubtree(movingPageId, byParent);
  }, [movingPageId, byParent]);

  useEffect(() => {
    if (!movingPageId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMovingPageId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [movingPageId]);

  const openRename = (pageId: string) => {
    const row = pages.find((p) => p.id === pageId);
    setRenameDraft(row?.title?.trim() ?? "");
    setRenamingPageId(pageId);
    closeMenu();
  };

  const commitRename = (pageId: string) => {
    const next = renameDraft.trim();
    const prev = pages.find((p) => p.id === pageId)?.title?.trim() ?? "";
    setRenamingPageId(null);
    setRenameDraft("");
    if (!next || next === prev) return;
    void postCommand({
      type: "page.update",
      payload: { page_id: pageId, title: next },
    });
  };

  const cancelRename = () => {
    setRenamingPageId(null);
    setRenameDraft("");
  };

  const runMoveUnder = async (parentId: string) => {
    if (!movingPageId) return;
    try {
      await postCommand({
        type: "page.move",
        payload: { page_id: movingPageId, parent_page_id: parentId },
      });
    } finally {
      setMovingPageId(null);
    }
  };

  const runMoveRoot = async () => {
    const pid = movingPageId;
    if (!pid) return;
    try {
      await postCommand({
        type: "page.move",
        payload: { page_id: pid },
      });
    } finally {
      setMovingPageId(null);
    }
  };

  const runArchive = async (pageId: string) => {
    if (!globalThis.confirm?.(t("shell.sidebarDeleteConfirm"))) return;
    closeMenu();
    try {
      await postCommand({
        type: "page.archive",
        payload: { page_id: pageId, archived: true },
      });
      if (routePageId === pageId) nav("/pages");
    } catch {
      /* no toast layer yet */
    }
  };

  const menuSurfaceClass =
    "min-w-[11rem] overflow-hidden border py-1 text-[13px] text-[var(--pa-fg)]";

  const menuBtnClass =
    "flex w-full items-center px-3 py-2 text-left text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)]";

  if (!spaceId) {
    return <p className="px-2 text-xs text-[var(--pa-tertiary)]">{t("shell.noSpace")}</p>;
  }

  const roots = byParent.get(null) ?? [];

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 py-1" aria-label={t("nav.pages")}>
      <Link
        to={`/pages/p/new?space=${encodeURIComponent(spaceId)}`}
        className="mb-1 flex items-center gap-2 rounded-sm px-2 py-[6px] text-[13px] text-[var(--pa-tertiary)] no-underline transition-colors hover:bg-[var(--pa-hover)] hover:text-[var(--pa-secondary)]"
      >
        <span className="text-[15px] font-normal leading-none text-[var(--pa-secondary)]">+</span>
        <span className="truncate">{t("shell.newPage")}</span>
      </Link>
      {roots.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--pa-divider)]/80 px-2 py-3 text-center">
          <p className="mb-2 text-[12px] leading-relaxed text-[var(--pa-tertiary)]">{t("shell.pagesEmpty")}</p>
          <Link
            to={`/pages/p/new?space=${encodeURIComponent(spaceId)}`}
            className="text-[12px] text-[var(--pa-accent)] hover:underline"
          >
            {t("shell.createFirstPage")}
          </Link>
        </div>
      ) : (
        <TreeBranch
          parentId={null}
          byParent={byParent}
          depth={0}
          spaceId={spaceId}
          starred={starred}
          onToggleStar={(pageId) => setStarred(toggleStarredPageId(pageId))}
          renamingPageId={renamingPageId}
          renameDraft={renameDraft}
          onRenameDraftChange={setRenameDraft}
          onRenameCommit={commitRename}
          onRenameCancel={cancelRename}
          onOpenMenu={(pageId, anchor) => {
            setMenuPageId(pageId);
            setMenuAnchorEl(anchor);
          }}
          openMenuPageId={menuPageId}
        />
      )}

      {menuPageId && menuAnchorEl && menuTarget ? (
        <PopoverPortal anchor={menuAnchorEl} placement="top-start" gap={6}>
          <div
            ref={menuPanelRef}
            role="menu"
            className={menuSurfaceClass}
            style={{
              borderRadius: "var(--pa-radius-md)",
              background: "var(--pa-surface)",
              borderColor: "var(--pa-divider)",
              boxShadow: "var(--pa-popover-shadow)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              className={menuBtnClass}
              onClick={() => openRename(menuPageId)}
            >
              {t("shell.sidebarRename")}
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuBtnClass}
              onClick={() => {
                const pid = menuPageId;
                closeMenu();
                setMovingPageId(pid);
              }}
            >
              {t("shell.sidebarMove")}
            </button>
            {menuTarget.parentPageId ? (
              <button
                type="button"
                role="menuitem"
                className={menuBtnClass}
                onClick={() => {
                  const pid = menuPageId;
                  if (!pid) return;
                  closeMenu();
                  void (async () => {
                    try {
                      await postCommand({
                        type: "page.move",
                        payload: { page_id: pid },
                      });
                    } catch {
                      /* ignore */
                    }
                  })();
                }}
              >
                {t("shell.sidebarMoveRoot")}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className={`${menuBtnClass} text-[var(--pa-danger)] hover:text-[var(--pa-danger)]`}
              onClick={() => {
                const pid = menuPageId;
                if (pid) void runArchive(pid);
              }}
            >
              {t("shell.sidebarDelete")}
            </button>
          </div>
        </PopoverPortal>
      ) : null}

      {movingPageId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--pa-fg)]/25 p-4"
          role="presentation"
          onMouseDown={() => setMovingPageId(null)}
        >
          <div
            className="w-full max-w-md border bg-[var(--pa-surface)] p-4"
            style={{
              borderRadius: "var(--pa-radius-md)",
              borderColor: "var(--pa-divider)",
              boxShadow: "var(--pa-popover-shadow)",
            }}
            role="dialog"
            aria-labelledby="page-tree-move-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="page-tree-move-title" className="mb-1 text-[15px] font-semibold text-[var(--pa-fg)]">
              {t("shell.sidebarMoveTitle")}
            </h2>
            <p className="mb-3 text-[12px] text-[var(--pa-secondary)]">{t("shell.sidebarMoveHint")}</p>
            <PagePickerList
              spaceId={spaceId}
              excludePageIds={moveExcludeIds}
              onPick={(id) => void runMoveUnder(id)}
              onCancel={() => setMovingPageId(null)}
            />
            <button
              type="button"
              className="mt-3 w-full rounded-md border border-[var(--pa-divider)] px-3 py-2 text-[13px] text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)]"
              onClick={() => void runMoveRoot()}
            >
              {t("shell.sidebarMoveRoot")}
            </button>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
