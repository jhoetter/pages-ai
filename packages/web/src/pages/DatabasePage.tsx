import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { apiGet, apiPost } from "@/lib/api";

type DbPayload = {
  database: { id: string; title: string };
  views: Array<{ id: string; name: string; type: string }>;
};

type QueryResult = {
  status: string;
  operations?: Array<{ payload?: { rows?: Array<{ id: string; cells: Record<string, unknown> }> } }>;
};

export function DatabasePage() {
  const { t } = useTranslation();
  const { databaseId } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["database", databaseId],
    enabled: Boolean(databaseId),
    queryFn: () => apiGet<DbPayload>(`/api/databases/${databaseId}`),
  });

  const firstViewId = data?.views[0]?.id;

  const { data: rowsResult } = useQuery({
    queryKey: ["database-query", databaseId, firstViewId],
    enabled: Boolean(databaseId && firstViewId),
    queryFn: () =>
      apiPost<QueryResult>(`/api/databases/${databaseId}/query`, { view_id: firstViewId }),
  });

  const rows =
    rowsResult?.operations?.find((o) => o.payload?.rows)?.payload?.rows ?? [];

  const columns =
    rows.length > 0 ? Array.from(new Set(rows.flatMap((r) => Object.keys(r.cells ?? {})))) : [];

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl">{t("db.title")}</h1>
        <p className="text-[var(--pa-secondary)] mt-2">{t("db.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="database-page">
      <h1 className="text-xl mb-2">{data?.database.title ?? t("db.title")}</h1>
      <p className="text-[var(--pa-secondary)] text-sm mb-4">{databaseId}</p>
      {isLoading && <p className="text-[var(--pa-tertiary)]">…</p>}
      {!isLoading && !firstViewId ? (
        <p className="text-[var(--pa-secondary)]">{t("db.noView")}</p>
      ) : null}
      {firstViewId && rows.length === 0 ? (
        <p className="text-[var(--pa-secondary)]">{t("db.emptyRows")}</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto border rounded" style={{ borderColor: "var(--pa-divider)" }}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--pa-divider)" }}>
                {columns.map((c) => (
                  <th key={c} className="text-left p-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b" style={{ borderColor: "var(--pa-divider)" }}>
                  {columns.map((c) => (
                    <td key={c} className="p-2 align-top">
                      {JSON.stringify(r.cells[c] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
