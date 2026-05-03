import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiGet } from "@/lib/api";

type ListRes = { databases: Array<{ id: string; title: string }> };

export function DatabasePicker(props: {
  spaceId: string;
  onCancel: () => void;
  onPickExisting: (databaseId: string) => void;
  onCreateNew: () => Promise<string>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["databases-list", props.spaceId],
    queryFn: () => apiGet<ListRes>(`/api/databases?space_id=${encodeURIComponent(props.spaceId)}`),
  });

  const rows = useMemo(() => data?.databases ?? [], [data?.databases]);
  const flatIds = useMemo(() => ["__new__", ...rows.map((r) => r.id)], [rows]);

  useEffect(() => {
    setSelected((i) => Math.min(i, Math.max(0, flatIds.length - 1)));
  }, [flatIds.length]);

  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => (flatIds.length ? (i + 1) % flatIds.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => (flatIds.length ? (i - 1 + flatIds.length) % flatIds.length : 0));
    } else if (e.key === "Enter" && flatIds.length) {
      e.preventDefault();
      void pickIndex(selected);
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    }
  };

  const pickIndex = async (idx: number) => {
    if (busy) return;
    const id = flatIds[idx];
    if (!id) return;
    if (id === "__new__") {
      setBusy(true);
      try {
        const dbId = await props.onCreateNew();
        props.onPickExisting(dbId);
      } catch {
        /* ignore */
      } finally {
        setBusy(false);
      }
      return;
    }
    props.onPickExisting(id);
  };

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      className="border flex flex-col overflow-hidden outline-none"
      style={{
        borderRadius: "var(--pa-radius-md)",
        background: "var(--pa-surface)",
        borderColor: "var(--pa-divider)",
        boxShadow: "var(--pa-popover-shadow)",
        minWidth: "280px",
        maxHeight: "min(320px, 70vh)",
      }}
      onKeyDown={onKeyDown}
    >
      <div className="px-3 py-2 text-xs font-medium border-b text-[var(--pa-secondary)]" style={{ borderColor: "var(--pa-divider)" }}>
        {t("editor.databasePickerTitle")}
      </div>
      <div className="overflow-y-auto flex-1 py-1 text-sm">
        {isLoading ? (
          <p className="px-3 py-4 text-[var(--pa-tertiary)] text-center text-xs">…</p>
        ) : (
          flatIds.map((id, idx) => {
            const isNew = id === "__new__";
            const label = isNew ? t("editor.databasePickerNew") : rows.find((r) => r.id === id)?.title ?? "…";
            return (
              <button
                key={id}
                type="button"
                disabled={busy}
                className={`w-full text-left px-3 py-2 truncate ${
                  idx === selected ? "bg-[var(--pa-hover)]" : "hover:bg-[var(--pa-hover)]"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pickIndex(idx)}
              >
                {isNew ? <span className="text-[var(--pa-accent)]">{label}</span> : label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
