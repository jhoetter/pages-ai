import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { apiGet, apiPost } from "@/lib/api";

type DbPayload = {
  database: { id: string; title: string };
  views: Array<{ id: string; name: string }>;
};

type QueryResult = {
  operations?: Array<{
    payload?: { rows?: Array<{ id: string; cells: Record<string, unknown> }> };
  }>;
};

export function InlineDatabaseBlock(props: { databaseId: string }) {
  const { t } = useTranslation();
  const { data: meta, error } = useQuery({
    queryKey: ["database", props.databaseId],
    queryFn: () => apiGet<DbPayload>(`/api/databases/${props.databaseId}`),
  });

  const viewId = meta?.views[0]?.id;
  const { data: queried } = useQuery({
    queryKey: ["database-query", props.databaseId, viewId],
    enabled: Boolean(viewId),
    queryFn: () =>
      apiPost<QueryResult>(`/api/databases/${props.databaseId}/query`, { view_id: viewId! }),
  });

  const rows =
    queried?.operations?.find((o) => o.payload?.rows)?.payload?.rows ?? [];
  const columns =
    rows.length > 0 ? Array.from(new Set(rows.flatMap((r) => Object.keys(r.cells ?? {})))) : [];

  if (error) {
    return (
      <div className="rounded border p-3 text-sm text-[var(--pa-secondary)]" style={{ borderColor: "var(--pa-divider)" }}>
        {t("db.notFound")}
      </div>
    );
  }

  return (
    <div
      className="rounded border overflow-hidden my-1"
      style={{ borderColor: "var(--pa-divider)", background: "var(--pa-surface)" }}
      data-testid="inline-database-block"
    >
      <div className="flex items-center justify-between px-2 py-1.5 border-b text-sm" style={{ borderColor: "var(--pa-divider)" }}>
        <span className="font-medium">{meta?.database.title ?? "…"}</span>
        <Link
          to={`/pages/db/${props.databaseId}`}
          className="text-[var(--pa-accent)] text-xs no-underline hover:underline"
        >
          {t("db.openFull")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="p-3 text-xs text-[var(--pa-tertiary)]">{t("db.emptyRows")}</div>
      ) : (
        <div className="overflow-x-auto max-h-48">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--pa-divider)" }}>
                {columns.map((c) => (
                  <th key={c} className="text-left p-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-b" style={{ borderColor: "var(--pa-divider)" }}>
                  {columns.map((c) => (
                    <td key={c} className="p-1.5 align-top max-w-[120px] truncate">
                      {String(r.cells[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
