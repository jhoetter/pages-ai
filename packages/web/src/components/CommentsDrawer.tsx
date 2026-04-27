import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiGet } from "@/lib/api";

type CommentRow = {
  id: string;
  pageId: string;
  blockId: string | null;
  authorId: string;
  body: Record<string, unknown>;
  createdAt: string;
};

export function CommentsDrawer(props: {
  pageId: string;
  blockId?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["comments", props.pageId],
    queryFn: () => apiGet<{ comments: CommentRow[] }>(`/api/comments?page_id=${props.pageId}`),
  });
  const comments = (data?.comments ?? []).filter((c) => {
    if (!props.blockId) return true;
    return c.blockId === props.blockId;
  });

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-80 border-l shadow-lg flex flex-col"
      style={{ background: "var(--pa-surface)", borderColor: "var(--pa-divider)" }}
      data-testid="comments-drawer"
    >
      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--pa-divider)" }}>
        <span className="font-medium">{t("comments.title")}</span>
        <button
          type="button"
          className="text-sm text-[var(--pa-accent)]"
          onClick={props.onClose}
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm">
        {isLoading && <p className="text-[var(--pa-tertiary)]">…</p>}
        {comments.length === 0 && !isLoading && (
          <p className="text-[var(--pa-secondary)]">—</p>
        )}
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="border-b pb-2" style={{ borderColor: "var(--pa-divider)" }}>
              <div className="text-xs text-[var(--pa-tertiary)]">{c.authorId}</div>
              <pre className="whitespace-pre-wrap font-sans mt-1">{JSON.stringify(c.body, null, 0)}</pre>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
