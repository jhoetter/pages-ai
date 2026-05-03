import { type AssetRef } from "@pagesai/core";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { useState } from "react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { FileUploadProgress } from "@/components/FileUploadProgress";
import { FileOfficeLightbox } from "@/components/FileOfficeLightbox";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { attachmentKindFor } from "@/lib/AttachmentViewer";
import { fileIconKind, fileKindIconColorVar, fileKindLabelKey } from "@/lib/fileIconKind";
import { runtimeApiBase, runtimeAuthHeaders } from "@/lib/runtime-config";
import { useAuthedObjectUrl } from "@/lib/useAuthedObjectUrl";
import type { BlockEntity } from "@/editor/page-body/types";

function focusFileEmbedCard(e: MouseEvent, isSelected: boolean, setSelected: (next: boolean) => void): void {
  if (e.button !== 0) {
    return;
  }
  const el = e.target as HTMLElement;
  if (el.closest("button, a, [role='button']")) {
    return;
  }
  e.preventDefault();
  if (e.shiftKey) {
    setSelected(!isSelected);
  } else {
    setSelected(true);
  }
}

export function FileEmbedBlock(props: { block: BlockEntity; pageId: string; lexicalKey: string }) {
  const [isSelected, setSelected] = useLexicalNodeSelection(props.lexicalKey);
  const { t } = useTranslation();
  const asset = props.block.properties["asset"] as AssetRef | undefined;
  const key = asset?.object_key;
  const blobUrl = useAuthedObjectUrl(key);
  const mime = asset?.mime_type ?? "";
  const name = asset?.display_name ?? t("file.open");
  const officeKind = attachmentKindFor(mime, name);
  const isOfficePreview = officeKind !== "other";
  const fileKind = fileIconKind({ name, mime });
  const kindColor = fileKindIconColorVar(fileKind);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedChrome =
    isSelected
      ? "ring-2 ring-[var(--pa-accent)] ring-offset-2 ring-offset-[var(--pa-bg)]"
      : "ring-0 ring-offset-0";

  const uploading = props.block.properties["uploading"] === true;
  const uploadError = props.block.properties["upload_error"] === true;
  const localFileName = props.block.properties["local_file_name"] as string | undefined;
  const uploadPercent = props.block.properties["upload_percent"] as number | null | undefined;

  if (uploadError && !asset) {
    return (
      <p className="text-xs text-[var(--pa-danger)] py-2" data-testid="file-embed-upload-error" role="alert">
        {t("canvas.uploadFailed")}
        {localFileName ? ` · ${localFileName}` : ""}
      </p>
    );
  }

  if (uploading || (!asset && localFileName)) {
    return (
      <div data-testid="file-embed-uploading">
        <FileUploadProgress
          fileName={localFileName ?? name}
          percent={uploadPercent ?? null}
          statusLabel={t("canvas.uploading")}
        />
      </div>
    );
  }

  const download = async () => {
    if (!key) return;
    const base = runtimeApiBase().replace(/\/$/, "");
    const headers = await runtimeAuthHeaders();
    const res = await fetch(`${base}/api/assets?key=${encodeURIComponent(key)}`, { headers });
    if (!res.ok) return;
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    URL.revokeObjectURL(u);
  };

  if (!asset) {
    return <p className="text-xs text-[var(--pa-tertiary)]">{t("canvas.fileUnset")}</p>;
  }

  if (mime.startsWith("image/")) {
    const imgKind = fileIconKind({ name, mime });
    const imgColor = fileKindIconColorVar(imgKind);
    if (!blobUrl) {
      return (
        <div className="text-xs text-[var(--pa-tertiary)] py-2" data-testid="file-embed-loading">
          …
        </div>
      );
    }
    return (
      <div
        className={[
          "overflow-hidden rounded-lg border transition-shadow hover:bg-[var(--pa-hover)]/30",
          selectedChrome,
        ].join(" ")}
        style={{ borderColor: "var(--pa-divider)" }}
        data-testid="file-embed-card"
        data-block-id={props.block.id}
        onMouseDown={(e) => focusFileEmbedCard(e, isSelected, setSelected)}
      >
        <img src={blobUrl} alt={name} className="max-h-72 w-full object-cover" draggable={false} />
        <div className="flex items-center gap-2.5 border-t px-3 py-2" style={{ borderColor: "var(--pa-divider)" }}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{
              color: imgColor,
              backgroundColor: `color-mix(in oklab, ${imgColor} 17%, transparent)`,
            }}
          >
            <FileTypeIcon name={name} mime={mime} size="md" className="text-current" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[var(--pa-fg)]" title={name}>
              {name}
            </p>
            <p className="text-[10px] font-medium text-[var(--pa-secondary)]">{t(fileKindLabelKey(imgKind))}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={[
          "flex gap-3 rounded-lg border px-3 py-2.5 transition-shadow hover:bg-[var(--pa-hover)]/40",
          selectedChrome,
        ].join(" ")}
        style={{ borderColor: "var(--pa-divider)" }}
        data-testid="file-embed-card"
        data-block-id={props.block.id}
        onMouseDown={(e) => focusFileEmbedCard(e, isSelected, setSelected)}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
          style={{
            color: kindColor,
            backgroundColor: `color-mix(in oklab, ${kindColor} 17%, transparent)`,
          }}
        >
          <FileTypeIcon name={name} mime={mime} size="md" className="text-current" />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-sm font-medium text-[var(--pa-fg)] leading-snug" title={name}>
            {name}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-[var(--pa-secondary)]">{t(fileKindLabelKey(fileKind))}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch justify-center gap-1.5 sm:flex-row sm:items-center">
          {isOfficePreview ? (
            <button
              type="button"
              className="rounded-md px-2.5 py-1.5 text-center text-xs font-medium text-[var(--pa-accent)] transition-colors hover:bg-[var(--pa-hover)] disabled:pointer-events-none disabled:opacity-40"
              disabled={!blobUrl}
              onClick={() => setPreviewOpen(true)}
            >
              {t("file.preview")}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-center text-xs font-medium text-[var(--pa-accent)] transition-colors hover:bg-[var(--pa-hover)]"
            onClick={() => void download()}
          >
            {t("file.download")}
          </button>
        </div>
      </div>
      {previewOpen && blobUrl ? (
        <FileOfficeLightbox url={blobUrl} name={name} mime={mime} onClose={() => setPreviewOpen(false)} />
      ) : null}
    </>
  );
}
