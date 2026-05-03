import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { apiPost } from "@/lib/api";
import { PageBodyEditor, type PageBodyEditorHandle } from "@/editor/page-body/PageBodyEditor";

export type { BlockEntity } from "@/editor/page-body/types";
import type { BlockEntity } from "@/editor/page-body/types";

/**
 * Thin host around the Lexical page body editor. New blocks are inserted via the slash menu
 * (typing `/` inside the editor) or via the per-block hover handles (`+` to insert below,
 * `⋮⋮` to drag/reorder or open the block actions menu).
 */
export function DocumentCanvas(props: {
  pageId: string;
  spaceId?: string;
  blocks: BlockEntity[];
  onOpenCommentsForBlock: (blockId: string) => void;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<PageBodyEditorHandle | null>(null);

  const createDatabaseAndView = useCallback(async (): Promise<string> => {
    if (!props.spaceId) throw new Error("space");
    const res = await apiPost<{ operations?: Array<{ payload?: { database?: { id: string } } }> }>(
      "/api/commands",
      {
        type: "db.create",
        payload: {
          space_id: props.spaceId,
          parent_page_id: props.pageId,
          title: t("db.untitled"),
        },
        actor_id: "web",
        actor_type: "human",
      },
    );
    const dbId = res.operations?.[0]?.payload?.database?.id;
    if (!dbId) throw new Error("no database id");
    return dbId;
  }, [props.pageId, props.spaceId, t]);

  return (
    <div className="document-canvas">
      <PageBodyEditor
        ref={editorRef}
        key={props.pageId}
        pageId={props.pageId}
        spaceId={props.spaceId}
        blocks={props.blocks}
        onCreateDatabase={createDatabaseAndView}
        onOpenComments={props.onOpenCommentsForBlock}
      />
    </div>
  );
}
