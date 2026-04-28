import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { DatabaseTableView } from "@/components/DatabaseTableView";
import { apiGet } from "@/lib/api";

type DbPayload = {
  database: { id: string; title: string };
};

export function DatabasePage() {
  const { t } = useTranslation();
  const { databaseId } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["database", databaseId],
    enabled: Boolean(databaseId),
    queryFn: () => apiGet<DbPayload>(`/api/databases/${databaseId}`),
  });

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
      {isLoading ? <p className="text-[var(--pa-tertiary)]">…</p> : null}
      {databaseId && !isLoading ? (
        <DatabaseTableView databaseId={databaseId} omitTitleRow showOpenLink={false} />
      ) : null}
    </div>
  );
}
