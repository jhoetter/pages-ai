import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { apiGet, apiPost } from "@/lib/api";

export type SchemaProperty = { id: string; name: string; type: string };

type DbPayload = {
  database: {
    id: string;
    title: string;
    schemaJson: { properties: SchemaProperty[] };
  };
  views: Array<{ id: string; name: string; type: string }>;
};

type QueryResult = {
  operations?: Array<{
    payload?: { rows?: Array<{ id: string; cells: Record<string, unknown> }> };
  }>;
};

function isTextLikeProperty(p: SchemaProperty): boolean {
  return p.type === "title" || p.type === "text";
}

export function DatabaseTableView(props: {
  databaseId: string;
  /** Inline preview: cap visible rows and height */
  compact?: boolean;
  showOpenLink?: boolean;
  /** Full database page already shows H1 — hide duplicate title row */
  omitTitleRow?: boolean;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: meta, error } = useQuery({
    queryKey: ["database", props.databaseId],
    queryFn: () => apiGet<DbPayload>(`/api/databases/${props.databaseId}`),
  });

  const views = meta?.views ?? [];
  const tableViews = useMemo(() => views.filter((v) => v.type === "table"), [views]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  useEffect(() => {
    if (!tableViews.length) {
      setActiveViewId(views[0]?.id ?? null);
      return;
    }
    setActiveViewId((cur) => {
      if (cur && tableViews.some((v) => v.id === cur)) return cur;
      return tableViews[0]!.id;
    });
  }, [tableViews, views]);

  const viewId = activeViewId ?? views[0]?.id;
  const activeView = views.find((v) => v.id === viewId);
  const unsupportedView = activeView && activeView.type !== "table";

  const { data: queried } = useQuery({
    queryKey: ["database-query", props.databaseId, viewId],
    enabled: Boolean(viewId) && !unsupportedView,
    queryFn: () =>
      apiPost<QueryResult>(`/api/databases/${props.databaseId}/query`, { view_id: viewId! }),
  });

  const schemaProps: SchemaProperty[] = meta?.database.schemaJson?.properties ?? [];
  const rows = queried?.operations?.find((o) => o.payload?.rows)?.payload?.rows ?? [];

  const invalidateDb = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["database", props.databaseId] });
    void qc.invalidateQueries({ queryKey: ["database-query", props.databaseId] });
  }, [qc, props.databaseId]);

  const { mutateAsync: addRow } = useMutation({
    mutationFn: async () => {
      const cells: Record<string, unknown> = {};
      for (const p of schemaProps) {
        cells[p.id] = "";
      }
      await apiPost("/api/commands", {
        type: "db.row.create",
        payload: { database_id: props.databaseId, cells },
        actor_id: "web",
        actor_type: "human",
      });
    },
    onSuccess: invalidateDb,
  });

  const { mutateAsync: addProperty } = useMutation({
    mutationFn: async (name: string) => {
      await apiPost("/api/commands", {
        type: "db.property.add",
        payload: { database_id: props.databaseId, name, type: "text" },
        actor_id: "web",
        actor_type: "human",
      });
    },
    onSuccess: invalidateDb,
  });

  const { mutateAsync: patchCell } = useMutation({
    mutationFn: async (args: { rowId: string; propertyId: string; value: string }) => {
      await apiPost("/api/commands", {
        type: "db.row.update",
        payload: {
          database_id: props.databaseId,
          row_id: args.rowId,
          cells: { [args.propertyId]: args.value },
        },
        actor_id: "web",
        actor_type: "human",
      });
    },
    onSuccess: invalidateDb,
  });

  const onAddPropertyClick = () => {
    const name = globalThis.prompt?.(t("db.addPropertyPrompt"));
    if (!name?.trim()) return;
    void addProperty(name.trim());
  };

  if (error) {
    return (
      <div className="rounded border p-3 text-sm text-[var(--pa-secondary)]" style={{ borderColor: "var(--pa-divider)" }}>
        {t("db.notFound")}
      </div>
    );
  }

  return (
    <div
      className={`rounded border overflow-hidden my-1 ${props.compact ? "" : ""}`}
      style={{ borderColor: "var(--pa-divider)", background: "var(--pa-surface)" }}
      data-testid={props.compact ? "inline-database-block" : "database-table-view"}
    >
      {!props.omitTitleRow ? (
        <div
          className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b text-sm"
          style={{ borderColor: "var(--pa-divider)" }}
        >
          <span className="font-medium">{meta?.database.title ?? "…"}</span>
          {props.showOpenLink ? (
            <Link
              to={`/pages/db/${props.databaseId}`}
              className="text-[var(--pa-accent)] text-xs no-underline hover:underline ml-auto"
            >
              {t("db.openFull")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {views.length > 1 ? (
        <div className="flex gap-1 px-2 py-1 border-b overflow-x-auto" style={{ borderColor: "var(--pa-divider)" }}>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`shrink-0 px-2 py-0.5 rounded text-xs ${
                v.id === viewId ? "bg-[var(--pa-hover)] font-medium" : "text-[var(--pa-tertiary)] hover:bg-[var(--pa-hover)]"
              }`}
              onClick={() => setActiveViewId(v.id)}
            >
              {v.name}
              {v.type !== "table" ? ` (${v.type})` : ""}
            </button>
          ))}
        </div>
      ) : null}

      {unsupportedView ? (
        <div className="p-3 text-xs text-[var(--pa-secondary)]">{t("db.viewUnsupported")}</div>
      ) : (
        <>
          {!props.compact ? (
            <div className="flex gap-2 px-2 py-1.5 border-b" style={{ borderColor: "var(--pa-divider)" }}>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md bg-[var(--pa-hover)] hover:opacity-90"
                onClick={() => void addRow()}
              >
                {t("db.addRow")}
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-md bg-[var(--pa-hover)] hover:opacity-90"
                onClick={onAddPropertyClick}
              >
                {t("db.addTextProperty")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 px-2 py-1 border-b" style={{ borderColor: "var(--pa-divider)" }}>
              <button
                type="button"
                className="text-xs px-2 py-0.5 rounded-md bg-[var(--pa-hover)] hover:opacity-90"
                onClick={() => void addRow()}
              >
                {t("db.addRow")}
              </button>
            </div>
          )}

          {schemaProps.length === 0 ? (
            <div className="p-3 text-xs text-[var(--pa-tertiary)]">{t("db.noSchema")}</div>
          ) : rows.length === 0 ? (
            <div className="p-3 text-xs text-[var(--pa-tertiary)]">{t("db.emptyRows")}</div>
          ) : (
            <div className={`overflow-x-auto ${props.compact ? "max-h-48" : ""}`}>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--pa-divider)" }}>
                    {schemaProps.map((c) => (
                      <th key={c.id} className="text-left p-1.5 font-medium whitespace-nowrap">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(props.compact ? rows.slice(0, 8) : rows).map((r) => (
                    <tr key={r.id} className="border-b" style={{ borderColor: "var(--pa-divider)" }}>
                      {schemaProps.map((c) => (
                        <td key={c.id} className="p-1 align-top min-w-[100px]">
                          {isTextLikeProperty(c) ? (
                            <CellInput
                              value={String(r.cells[c.id] ?? "")}
                              onCommit={(v) => void patchCell({ rowId: r.id, propertyId: c.id, value: v })}
                            />
                          ) : (
                            <span className="block max-w-[140px] truncate">{String(r.cells[c.id] ?? "")}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CellInput(props: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(props.value);
  useEffect(() => {
    setLocal(props.value);
  }, [props.value]);
  return (
    <input
      className="w-full min-w-[80px] bg-transparent border border-transparent hover:border-[var(--pa-divider)] focus:border-[var(--pa-accent)] rounded px-1 py-0.5 text-xs outline-none"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== props.value) props.onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
