import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet } from "@/lib/api";

type SearchRes = { results: Array<{ id: string; title: string }> };
type PagesRes = { operations?: Array<{ payload?: { pages?: Array<{ id: string; title: string }> } }> };

type PagePickerListProps = {
  spaceId: string | undefined;
  excludePageId?: string;
  onPick: (pageId: string, title: string) => void;
  onCancel: () => void;
};

export function PagePickerList(props: PagePickerListProps) {
  const { t } = useTranslation();
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

  const { data: pagesData } = useQuery({
    queryKey: ["pages-flat", props.spaceId],
    enabled: Boolean(props.spaceId) && query.length === 0,
    queryFn: () =>
      apiGet<PagesRes>(`/api/pages?space_id=${props.spaceId}&all_in_space=1`),
  });

  const rows = useMemo(() => {
    const ex = props.excludePageId;
    if (query.length > 0) {
      const r = searchData?.results ?? [];
      return ex ? r.filter((x) => x.id !== ex) : r;
    }
    const raw = pagesData?.operations?.[0]?.payload?.pages ?? [];
    const mapped = raw.map((p) => ({ id: p.id, title: p.title || "…" }));
    const filtered = ex ? mapped.filter((x) => x.id !== ex) : mapped;
    return filtered.slice(0, 40);
  }, [query, searchData, pagesData, props.excludePageId]);

  useEffect(() => {
    setSelected((i) => Math.min(i, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const showEmpty =
    query.length > 0 && searchFetched && rows.length === 0;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter" && rows[selected]) {
      e.preventDefault();
      const r = rows[selected]!;
      props.onPick(r.id, r.title || t("canvas.untitled"));
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
              key={r.id}
              type="button"
              className={`w-full text-left px-3 py-2 truncate ${
                idx === selected ? "bg-[var(--pa-hover)]" : "hover:bg-[var(--pa-hover)]"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => props.onPick(r.id, r.title || t("canvas.untitled"))}
            >
              {r.title || "…"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
