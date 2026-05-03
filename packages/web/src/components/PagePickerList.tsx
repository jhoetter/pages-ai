import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet, apiPost } from "@/lib/api";
import { useSpacePagesFlat } from "@/lib/useSpacePagesFlat";

type SearchRes = { results: Array<{ id: string; title: string }> };

type PagePickerListProps = {
  spaceId: string | undefined;
  /** When creating a page from the picker, set as parent (optional). */
  parentPageId?: string;
  excludePageId?: string;
  /** Additional IDs that cannot be chosen (e.g. page being moved plus its subtree). */
  excludePageIds?: ReadonlyArray<string>;
  onPick: (pageId: string, title: string) => void;
  onCancel: () => void;
};

export function PagePickerList(props: PagePickerListProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = q.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data: searchData, isFetched: searchFetched } = useQuery({
    queryKey: ["page-picker-search", query],
    enabled: query.length > 0,
    queryFn: () => apiGet<SearchRes>(`/api/search?q=${encodeURIComponent(query)}`),
  });

  const { data: flatPages = [] } = useSpacePagesFlat(props.spaceId, {
    enabled: Boolean(props.spaceId) && query.length === 0,
  });

  const excludedIds = useMemo(() => {
    const s = new Set<string>();
    if (props.excludePageId) s.add(props.excludePageId);
    for (const id of props.excludePageIds ?? []) {
      if (id) s.add(id);
    }
    return s;
  }, [props.excludePageId, props.excludePageIds]);

  const baseRows = useMemo(() => {
    if (query.length > 0) {
      const r = searchData?.results ?? [];
      return excludedIds.size ? r.filter((x) => !excludedIds.has(x.id)) : r;
    }
    const mapped = flatPages.map((p) => ({ id: p.id, title: p.title || "…" }));
    const filtered = excludedIds.size ? mapped.filter((x) => !excludedIds.has(x.id)) : mapped;
    return filtered.slice(0, 40);
  }, [query, searchData, flatPages, excludedIds]);

  const canCreate =
    Boolean(props.spaceId) &&
    query.length > 0 &&
    !baseRows.some((r) => r.title.toLowerCase() === query.toLowerCase());

  const rows = useMemo(() => {
    if (!canCreate) return baseRows;
    return [
      {
        id: "__create__",
        title: t("editor.pagePickerCreate", { title: query }),
      },
      ...baseRows,
    ];
  }, [baseRows, canCreate, query, t]);

  const { mutateAsync: createPage } = useMutation({
    mutationFn: async (title: string) => {
      const payload: Record<string, unknown> = {
        space_id: props.spaceId!,
        title,
      };
      if (props.parentPageId) payload["parent_page_id"] = props.parentPageId;
      return apiPost<{ operations?: Array<{ payload?: { page?: { id: string } } }> }>("/api/commands", {
        type: "page.create",
        payload,
        actor_id: "web",
        actor_type: "human",
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pages-flat"] });
      void qc.invalidateQueries({ queryKey: ["page-picker-search"] });
    },
  });

  useEffect(() => {
    setSelected((i) => Math.min(i, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const showEmpty = query.length > 0 && searchFetched && rows.length === 0;

  const pickRow = async (r: { id: string; title: string }) => {
    if (r.id === "__create__") {
      const title = query;
      const res = await createPage(title);
      const id = res.operations?.[0]?.payload?.page?.id;
      if (id) props.onPick(id, title);
      return;
    }
    props.onPick(r.id, r.title || t("canvas.untitled"));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter" && rows[selected]) {
      e.preventDefault();
      void pickRow(rows[selected]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    }
  };

  return (
    <div
      className="border flex flex-col overflow-hidden"
      style={{
        borderRadius: "var(--pa-radius-md)",
        background: "var(--pa-surface)",
        borderColor: "var(--pa-divider)",
        boxShadow: "var(--pa-popover-shadow)",
        minWidth: "260px",
        maxHeight: "min(320px, 70vh)",
      }}
    >
      <input
        ref={inputRef}
        type="search"
        className="w-full px-3 py-2 text-sm border-b outline-none bg-transparent"
        style={{ borderColor: "var(--pa-divider)" }}
        placeholder={t("editor.pagePickerPlaceholder")}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSelected(0);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="overflow-y-auto flex-1 py-1 text-sm">
        {!props.spaceId && query.length === 0 ? (
          <p className="px-3 py-4 text-[var(--pa-tertiary)] text-center text-xs">{t("editor.pagePickerNoSpace")}</p>
        ) : showEmpty ? (
          <p className="px-3 py-4 text-[var(--pa-tertiary)] text-center text-xs">{t("editor.pagePickerEmpty")}</p>
        ) : rows.length === 0 && query.length === 0 ? (
          <p className="px-3 py-4 text-[var(--pa-tertiary)] text-center text-xs">{t("shell.pagesEmpty")}</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-[var(--pa-tertiary)] text-center text-xs">{t("editor.pagePickerEmpty")}</p>
        ) : (
          rows.map((r, idx) => (
            <button
              key={r.id === "__create__" ? "__create__" : r.id}
              type="button"
              className={`w-full text-left px-3 py-2 truncate ${
                idx === selected ? "bg-[var(--pa-hover)]" : "hover:bg-[var(--pa-hover)]"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void pickRow(r)}
            >
              {r.id === "__create__" ? <span className="text-[var(--pa-accent)]">{r.title}</span> : r.title || "…"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
