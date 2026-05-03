import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyColorScheme, getStoredColorScheme, setStoredColorScheme } from "@hofos/shell-ui";
import { useShortcut } from "@hofos/ux";
import { CornerDownLeft, ImageIcon, MessageSquare, Smile, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { CommandPalette } from "@/components/CommandPalette";
import { CommentsDrawer } from "@/components/CommentsDrawer";
import { DocumentCanvas, type BlockEntity } from "@/components/DocumentCanvas";
import { EmojiPicker } from "@/components/EmojiPicker";
import { PageEditorStickyHeader } from "@/components/PageEditorStickyHeader";
import { PageCoverBand, type PageCoverBandHandle } from "@/components/PageCoverBand";
import { PopoverPortal } from "@/components/PopoverPortal";
import { apiGet, apiPost } from "@/lib/api";
import { expandHofShellSidebar, useHofShellSidebarCollapsed } from "@/lib/hofShellSidebar";
import { useSpacePagesFlat } from "@/lib/useSpacePagesFlat";

/** Left rail outside max-w-3xl prose (space for drag ··· later); keeps caret/title flush. */
function PageProseWithLeftRail(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-[min(100%,calc(48rem+2.25rem))] gap-2 px-8 ${props.className ?? ""}`}
    >
      <div className="w-7 shrink-0 max-sm:hidden" aria-hidden />
      <div className="min-w-0 flex-1 max-w-3xl">{props.children}</div>
    </div>
  );
}

type PagePayload = {
  page: {
    id: string;
    title: string;
    spaceId: string;
    parentPageId: string | null;
    icon: string | null;
    coverImageUrl: string | null;
    coverImagePosition: string | null;
  };
  blocks: Array<{
    id: string;
    type: string;
    content: Record<string, unknown>;
    properties?: Record<string, unknown>;
    sortOrder: number;
  }>;
};

type BacklinksPayload = { backlinks: Array<{ pageId: string; blockId: string }> };

export function PageEditor(props: { spaceId: string; hideChrome?: boolean }) {
  const { pageId } = useParams();
  const [search, setSearch] = useSearchParams();
  const block = search.get("block");
  const commentsOpen = search.get("comments") === "1" || search.get("panel") === "comments";
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [palette, setPalette] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [iconDraft, setIconDraft] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const pageIconButtonRef = useRef<HTMLButtonElement>(null);
  const metaAddIconRef = useRef<HTMLButtonElement>(null);
  const coverAddToolbarRef = useRef<HTMLButtonElement>(null);
  const backlinkBtnRef = useRef<HTMLButtonElement>(null);
  const backlinksPanelRef = useRef<HTMLDivElement>(null);
  const coverBandRef = useRef<PageCoverBandHandle | null>(null);
  const [backlinksPopoverOpen, setBacklinksPopoverOpen] = useState(false);
  const [coverDraft, setCoverDraft] = useState("");
  const [coverPositionDraft, setCoverPositionDraft] = useState<string | null>(null);

  const sidebarCollapsed = useHofShellSidebarCollapsed();

  useShortcut(
    useMemo(
      () => [
        {
          key: "k",
          meta: true,
          capture: true,
          stopPropagation: true,
          stopImmediatePropagation: true,
          description: "Toggle command palette",
          run: () => setPalette((open) => !open),
        },
      ],
      [],
    ),
  );

  const effectiveSpace = props.spaceId || search.get("space") || "";

  const { data } = useQuery({
    queryKey: ["page", pageId],
    enabled: Boolean(pageId && pageId !== "new"),
    queryFn: () => apiGet<PagePayload>(`/api/pages/${pageId}`),
  });

  const showChrome = !props.hideChrome;
  const chromePageReady = Boolean(showChrome && pageId && pageId !== "new");

  const { data: backlinksPayload } = useQuery({
    queryKey: ["backlinks", pageId],
    enabled: chromePageReady,
    queryFn: () => apiGet<BacklinksPayload>(`/api/backlinks/${pageId}`),
  });

  const uniqueBacklinkPageIds = useMemo(() => {
    const raw = backlinksPayload?.backlinks ?? [];
    return [...new Set(raw.map((b) => b.pageId))];
  }, [backlinksPayload]);

  const spaceForCommands = data?.page.spaceId ?? effectiveSpace;

  const { data: pagesFlat = [] } = useSpacePagesFlat(spaceForCommands || undefined, {
    enabled: Boolean(chromePageReady && spaceForCommands),
  });

  const pageTitleById = useCallback(
    (id: string) => {
      const row = pagesFlat.find((p) => p.id === id);
      const title = row?.title?.trim();
      return title ? title : t("canvas.untitled");
    },
    [pagesFlat, t],
  );

  useEffect(() => {
    if (!data?.page) return;
    setTitleDraft(data.page.title);
    setIconDraft(data.page.icon ?? "");
    setCoverDraft(data.page.coverImageUrl ?? "");
    setCoverPositionDraft(data.page.coverImagePosition ?? null);
  }, [data?.page?.id, data?.page?.title, data?.page?.icon, data?.page?.coverImageUrl, data?.page?.coverImagePosition]);

  const parentForNewPage = search.get("parent") ?? undefined;

  const { mutate: runCreatePage, isError, error } = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        space_id: effectiveSpace,
        title: t("palette.newPage"),
      };
      if (parentForNewPage) payload["parent_page_id"] = parentForNewPage;
      return apiPost<unknown>("/api/commands", {
        type: "page.create",
        payload,
        actor_id: "web",
        actor_type: "human",
      });
    },
    onSuccess: (res) => {
      const r = res as { operations?: Array<{ payload?: { page?: { id: string } } }> };
      const id = r.operations?.[0]?.payload?.page?.id;
      if (id) {
        void qc.invalidateQueries({ queryKey: ["spaces"] });
        void qc.invalidateQueries({ queryKey: ["pages-flat"] });
        const q = block ? `?block=${encodeURIComponent(block)}` : "";
        nav(`/pages/p/${id}${q}`, { replace: true });
      }
    },
  });

  const lastAutoCreateKey = useRef<string | null>(null);
  useEffect(() => {
    if (pageId !== "new") {
      lastAutoCreateKey.current = null;
    }
  }, [pageId]);

  useEffect(() => {
    if (pageId !== "new" || !effectiveSpace) return;
    const key = `${effectiveSpace}\0${parentForNewPage ?? ""}`;
    if (lastAutoCreateKey.current === key) return;
    lastAutoCreateKey.current = key;
    runCreatePage();
  }, [pageId, effectiveSpace, parentForNewPage, runCreatePage]);

  const persistPageMeta = async (payload: Record<string, unknown>) => {
    if (!pageId || pageId === "new") return;
    await apiPost("/api/commands", {
      type: "page.update",
      payload: { page_id: pageId, ...payload },
      actor_id: "web",
      actor_type: "human",
    });
    void qc.invalidateQueries({ queryKey: ["page", pageId] });
    void qc.invalidateQueries({ queryKey: ["pages-flat"] });
  };

  useEffect(() => {
    if (block && data?.blocks?.length) {
      const el = document.getElementById(`block-${block}`);
      el?.scrollIntoView({ block: "center" });
    }
  }, [block, data]);

  const closeComments = () => {
    const next = new URLSearchParams(search);
    next.delete("comments");
    next.delete("panel");
    setSearch(next, { replace: true });
  };

  const openComments = () => {
    const next = new URLSearchParams(search);
    next.set("comments", "1");
    setSearch(next, { replace: true });
  };

  const onOpenCommentsForBlock = (blockId: string) => {
    const next = new URLSearchParams(search);
    next.set("comments", "1");
    next.set("block", blockId);
    setSearch(next, { replace: true });
  };

  const blocksForCanvas: BlockEntity[] = useMemo(() => {
    const raw = data?.blocks ?? [];
    return raw.map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content,
      properties: b.properties ?? {},
      sortOrder: b.sortOrder,
    }));
  }, [data?.blocks]);

  const hasCover = Boolean(coverDraft.trim());
  const hasIcon = Boolean(iconDraft.trim());
  const backlinkPageCount = uniqueBacklinkPageIds.length;

  /** Padding for four combos: bare | icon-only | cover-only | cover+icon (matches Notion-ish rhythm). */
  const pageHeaderStackClass = useMemo(() => {
    if (hasCover && hasIcon) return "relative z-10 -mt-11 mb-1.5 flex flex-col";
    if (hasCover && !hasIcon) return "relative z-10 mb-1.5 flex flex-col";
    return "relative mb-1.5 flex flex-col pt-7 sm:pt-8";
  }, [hasCover, hasIcon]);

  const pageTitleStackClass = useMemo(() => {
    if (hasCover && !hasIcon) return "flex min-w-0 flex-col gap-1 pt-3 sm:pt-4";
    if (hasCover && hasIcon) return "flex min-w-0 flex-col gap-1";
    if (!hasCover && hasIcon) return "flex min-w-0 flex-col gap-1";
    return "flex min-w-0 flex-col gap-1 pt-2.5 sm:pt-3";
  }, [hasCover, hasIcon]);

  const metaActionClass =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--pa-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pa-bg)]";

  const clearPageIcon = () => {
    setIconDraft("");
    setIconPickerOpen(false);
    void persistPageMeta({ icon: null });
  };

  useEffect(() => {
    setBacklinksPopoverOpen(false);
  }, [pageId]);

  useEffect(() => {
    if (!backlinksPopoverOpen) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (backlinksPanelRef.current?.contains(node)) return;
      if (backlinkBtnRef.current?.contains(node)) return;
      setBacklinksPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [backlinksPopoverOpen]);

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 w-full min-w-0 flex flex-col">
        {showChrome && pageId && pageId !== "new" ? (
          <div className="group/page-header w-full">
            {data?.page && spaceForCommands ? (
              <PageEditorStickyHeader
                spaceId={spaceForCommands}
                pageId={pageId}
                currentTitle={titleDraft}
                sidebarCollapsed={sidebarCollapsed}
                onExpandSidebar={expandHofShellSidebar}
              />
            ) : null}
            <PageCoverBand
              ref={coverBandRef}
              show
              coverDraft={coverDraft}
              coverPosition={coverPositionDraft}
              onDraftChange={setCoverDraft}
              onCommit={(url) => {
                setCoverPositionDraft(null);
                void persistPageMeta({
                  cover_image_url: url,
                  cover_image_position: null,
                });
              }}
              onCoverPositionCommit={(position) => {
                setCoverPositionDraft(position);
                void persistPageMeta({ cover_image_position: position });
              }}
              t={t}
            />
            <PageProseWithLeftRail>
              <div className={`${pageHeaderStackClass} group/page-meta`}>
                {/* Out of document flow so a hidden meta strip does not push the icon/title down; still participates in hover via group/page-meta. */}
                <div
                  className={`absolute left-0 top-0 z-30 flex max-w-full flex-wrap items-center gap-x-2 gap-y-1.5 pr-8 text-[13px] text-[var(--pa-secondary)] transition-opacity duration-150 ${
                    hasIcon ? "pl-[5.75rem] sm:pl-[6rem]" : ""
                  } ${
                    iconPickerOpen || backlinksPopoverOpen
                      ? "opacity-100"
                      : "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 [@media(hover:hover)]:group-hover/page-meta:pointer-events-auto [@media(hover:hover)]:group-hover/page-meta:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:opacity-100"
                  }`}
                >
                  {backlinkPageCount > 0 ? (
                    <>
                      <button
                        ref={backlinkBtnRef}
                        type="button"
                        className={metaActionClass}
                        aria-expanded={backlinksPopoverOpen}
                        aria-haspopup="dialog"
                        onClick={() => setBacklinksPopoverOpen((o) => !o)}
                      >
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                        {backlinkPageCount === 1
                          ? t("canvas.meta.backlinkSingular")
                          : t("canvas.meta.backlinkPlural", { count: backlinkPageCount })}
                      </button>
                      {backlinksPopoverOpen ? (
                        <PopoverPortal anchor={backlinkBtnRef.current} placement="bottom-start" gap={8}>
                          <div
                            ref={backlinksPanelRef}
                            className="border p-3 w-[min(18rem,calc(100vw-2rem))] max-h-[min(16rem,50vh)] overflow-y-auto"
                            style={{
                              borderRadius: "var(--pa-radius-md)",
                              background: "var(--pa-surface)",
                              borderColor: "var(--pa-divider)",
                              boxShadow: "var(--pa-popover-shadow)",
                            }}
                          >
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--pa-tertiary)] mb-2">
                              {t("canvas.meta.backlinksHeading")}
                            </p>
                            <ul className="space-y-1">
                              {uniqueBacklinkPageIds.map((pid) => (
                                <li key={pid}>
                                  <Link
                                    to={`/pages/p/${pid}`}
                                    className="block rounded px-1 py-0.5 text-[var(--pa-fg)] hover:bg-[var(--pa-hover)]"
                                    onClick={() => setBacklinksPopoverOpen(false)}
                                  >
                                    {pageTitleById(pid)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </PopoverPortal>
                      ) : null}
                    </>
                  ) : null}
                  {!iconDraft ? (
                    <button
                      ref={metaAddIconRef}
                      type="button"
                      className={metaActionClass}
                      aria-label={t("canvas.meta.addIcon")}
                      aria-expanded={iconPickerOpen}
                      onClick={() => setIconPickerOpen((open) => !open)}
                    >
                      <Smile className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                      {t("canvas.meta.addIcon")}
                    </button>
                  ) : null}
                  {!hasCover ? (
                    <button
                      ref={coverAddToolbarRef}
                      type="button"
                      className={metaActionClass}
                      aria-label={t("canvas.meta.addCover")}
                      onClick={() => coverBandRef.current?.openGallery(coverAddToolbarRef.current)}
                    >
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                      {t("canvas.meta.addCover")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={metaActionClass}
                    aria-label={t("canvas.meta.addComment")}
                    onClick={openComments}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    {t("canvas.meta.addComment")}
                  </button>
                </div>

                <div className={pageTitleStackClass}>
                  {iconDraft ? (
                    <div className="group/page-icon relative z-40 flex items-start gap-2">
                      <div className="relative inline-flex">
                        <button
                          ref={pageIconButtonRef}
                          type="button"
                          className="h-[4.25rem] w-[4.25rem] sm:h-20 sm:w-20 shrink-0 flex items-center justify-center text-[3rem] sm:text-[3.5rem] leading-none rounded-lg bg-[var(--pa-bg)] border-0 outline-none cursor-pointer ring-0 transition-all duration-200 group-hover/page-icon:bg-[var(--pa-hover)] group-hover/page-header:bg-[var(--pa-hover)] group-hover/page-icon:ring-1 group-hover/page-header:ring-1 group-hover/page-icon:ring-[var(--pa-divider)] group-hover/page-header:ring-[var(--pa-divider)] focus-visible:ring-2 focus-visible:ring-[var(--pa-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--pa-bg)]"
                          aria-label={t("canvas.pageIcon")}
                          aria-expanded={iconPickerOpen}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => setIconPickerOpen((open) => !open)}
                        >
                          <span aria-hidden="true">{iconDraft}</span>
                        </button>
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--pa-divider)] bg-[var(--pa-bg)] text-[var(--pa-secondary)] shadow-sm opacity-0 pointer-events-none transition-opacity duration-200 group-hover/page-icon:opacity-100 group-hover/page-icon:pointer-events-auto hover:bg-[var(--pa-hover)] hover:text-[var(--pa-fg)] focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pa-accent)]"
                          aria-label={t("canvas.pageIconRemove")}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={clearPageIcon}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {iconPickerOpen ? (
                    <PopoverPortal
                      anchor={(iconDraft ? pageIconButtonRef : metaAddIconRef).current}
                      placement="top-start"
                    >
                      <EmojiPicker
                        onPick={(emoji) => {
                          setIconDraft(emoji);
                          setIconPickerOpen(false);
                          void persistPageMeta({ icon: emoji || null });
                        }}
                        onClose={() => setIconPickerOpen(false)}
                        onRemove={iconDraft ? clearPageIcon : undefined}
                        removeLabel={iconDraft ? t("canvas.pageIconRemove") : undefined}
                      />
                    </PopoverPortal>
                  ) : null}

                  <input
                    className={`w-full text-[2.5rem] font-bold leading-snug tracking-tight bg-transparent border-0 outline-none placeholder:text-[var(--pa-tertiary)] pb-1 ${iconDraft ? "pt-0" : "pt-0.5"}`}
                    value={titleDraft}
                    placeholder={t("canvas.untitled")}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      if (titleDraft.trim()) void persistPageMeta({ title: titleDraft.trim() });
                    }}
                  />
                </div>
              </div>
            </PageProseWithLeftRail>
          </div>
        ) : null}

        {!showChrome && pageId && pageId !== "new" ? (
          <PageProseWithLeftRail className="pt-6">
            <input
              className="mb-4 w-full text-[2.5rem] font-bold leading-tight tracking-tight bg-transparent border-0 outline-none placeholder:text-[var(--pa-tertiary)]"
              value={titleDraft}
              placeholder={t("canvas.untitled")}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft.trim()) void persistPageMeta({ title: titleDraft.trim() });
              }}
            />
          </PageProseWithLeftRail>
        ) : null}

        <PageProseWithLeftRail className="flex-1 pb-10 pt-0">
          {pageId && pageId !== "new" ? (
            data ? (
              <div className="space-y-0">
                <div id={`block-${block ?? ""}`} />
                <DocumentCanvas
                  pageId={pageId}
                  spaceId={spaceForCommands || undefined}
                  blocks={blocksForCanvas}
                  onOpenCommentsForBlock={onOpenCommentsForBlock}
                />
              </div>
            ) : (
              <p className="text-[var(--pa-secondary)]">…</p>
            )
          ) : (
            <>
              {isError ? (
                <p className="text-sm text-[var(--pa-secondary)] whitespace-pre-wrap">
                  {(error as Error)?.message ?? t("shell.noSpace")}
                </p>
              ) : (
                <p className="text-[var(--pa-secondary)]">…</p>
              )}
            </>
          )}
        </PageProseWithLeftRail>
      </main>

      {commentsOpen && pageId && pageId !== "new" ? (
        <CommentsDrawer pageId={pageId} blockId={block} onClose={closeComments} />
      ) : null}
      <CommandPalette
        open={palette}
        onOpenChange={setPalette}
        spaceId={spaceForCommands}
        pageId={pageId && pageId !== "new" ? pageId : undefined}
        onOpenComments={openComments}
        onCreatePage={() => {
          const space = props.spaceId || effectiveSpace;
          const cur = pageId && pageId !== "new" ? pageId : undefined;
          const base = `/pages/p/new?space=${encodeURIComponent(space)}`;
          nav(cur ? `${base}&parent=${encodeURIComponent(cur)}` : base);
        }}
        onToggleTheme={() => {
          const next = getStoredColorScheme() === "dark" ? "light" : "dark";
          setStoredColorScheme(next);
          applyColorScheme(next);
        }}
        onToggleLang={() => undefined}
      />
    </div>
  );
}
