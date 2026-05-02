import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useShortcut } from "@hofos/ux";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CommandPalette } from "@/components/CommandPalette";
import { CommentsDrawer } from "@/components/CommentsDrawer";
import { DocumentCanvas, type BlockEntity } from "@/components/DocumentCanvas";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageCoverBand } from "@/components/PageCoverBand";
import { apiGet, apiPost } from "@/lib/api";

type PagePayload = {
  page: {
    id: string;
    title: string;
    spaceId: string;
    parentPageId: string | null;
    icon: string | null;
    coverImageUrl: string | null;
  };
  blocks: Array<{
    id: string;
    type: string;
    content: Record<string, unknown>;
    properties?: Record<string, unknown>;
    sortOrder: number;
  }>;
};

export function PageEditor(props: { spaceId: string; hideChrome?: boolean }) {
  const { pageId } = useParams();
  const [search, setSearch] = useSearchParams();
  const block = search.get("block");
  const commentsOpen = search.get("comments") === "1" || search.get("panel") === "comments";
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [palette, setPalette] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [titleDraft, setTitleDraft] = useState("");
  const [iconDraft, setIconDraft] = useState("");
  const [coverDraft, setCoverDraft] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useShortcut(
    useMemo(
      () => [
        {
          key: "k",
          meta: true,
          description: "Open command palette",
          run: () => setPalette(true),
        },
      ],
      [],
    ),
  );

  const effectiveSpace = props.spaceId || search.get("space") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["page", pageId],
    enabled: Boolean(pageId && pageId !== "new"),
    queryFn: () => apiGet<PagePayload>(`/api/pages/${pageId}`),
  });

  useEffect(() => {
    if (!data?.page) return;
    setTitleDraft(data.page.title);
    setIconDraft(data.page.icon ?? "");
    setCoverDraft(data.page.coverImageUrl ?? "");
  }, [data?.page?.id, data?.page?.title, data?.page?.icon, data?.page?.coverImageUrl]);

  const spaceForCommands = data?.page.spaceId ?? effectiveSpace;

  const parentForNewPage = search.get("parent") ?? undefined;

  const { mutate: runCreatePage } = useMutation({
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

  const showChrome = !props.hideChrome;

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto px-8 py-10">
        {showChrome && pageId && pageId !== "new" && data?.page && spaceForCommands ? (
          <PageBreadcrumbs spaceId={spaceForCommands} pageId={pageId} />
        ) : null}

        {showChrome && pageId && pageId !== "new" ? (
          <PageCoverBand
            show
            coverDraft={coverDraft}
            onDraftChange={setCoverDraft}
            onCommit={(url) =>
              void persistPageMeta({
                cover_image_url: url,
              })
            }
            t={t}
          />
        ) : null}

        {isLoading && pageId !== "new" ? <p className="text-[var(--pa-secondary)]">…</p> : null}

        {pageId && pageId !== "new" ? (
          <div className="space-y-1">
            <div className="flex flex-col gap-1 pt-1">
              {showChrome ? (
                <div className="flex items-start gap-2">
                  <input
                    className="w-12 h-12 shrink-0 text-center text-2xl leading-none rounded-lg bg-transparent border-0 outline-none hover:bg-[var(--pa-hover)] focus:bg-[var(--pa-hover)] transition-colors"
                    placeholder="📄"
                    value={iconDraft}
                    aria-label={t("canvas.pageIcon")}
                    onChange={(e) => setIconDraft(e.target.value)}
                    onBlur={() => void persistPageMeta({ icon: iconDraft || null })}
                  />
                  {spaceForCommands ? (
                    <button
                      type="button"
                      className="mt-2 text-sm text-[var(--pa-accent)] hover:underline"
                      onClick={() =>
                        nav(
                          `/pages/p/new?space=${encodeURIComponent(spaceForCommands)}&parent=${encodeURIComponent(pageId)}`,
                        )
                      }
                    >
                      {t("editor.newSubpage")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <input
                className="w-full text-[2.5rem] font-bold leading-tight tracking-tight bg-transparent border-0 outline-none placeholder:text-[var(--pa-tertiary)]"
                value={titleDraft}
                placeholder={t("canvas.untitled")}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  if (titleDraft.trim()) void persistPageMeta({ title: titleDraft.trim() });
                }}
              />
            </div>
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
        )}
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
        onCreatePage={() =>
          nav(`/pages/p/new?space=${encodeURIComponent(props.spaceId || effectiveSpace)}`)
        }
        onToggleTheme={() => setTheme((x) => (x === "light" ? "dark" : "light"))}
        onToggleLang={() => undefined}
      />
    </div>
  );
}
