import { Download, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { AttachmentViewer } from "@/lib/AttachmentViewer";
import { fileIconKind, fileKindIconColorVar } from "@/lib/fileIconKind";

export interface FileOfficeLightboxProps {
  url: string;
  name: string;
  mime: string;
  onClose: () => void;
}

export function FileOfficeLightbox({ url, name, mime, onClose }: FileOfficeLightboxProps) {
  const fileKind = fileIconKind({ name, mime });
  const kindColor = fileKindIconColorVar(fileKind);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="flex min-w-0 items-center gap-3 truncate text-sm font-medium text-white">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/10"
            style={{ color: kindColor }}
          >
            <FileTypeIcon name={name} mime={mime} size="md" className="text-current" />
          </span>
          <span className="min-w-0 truncate">{name}</span>
        </p>
        <div className="flex items-center gap-1">
          <a
            href={url}
            download={name}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Download"
          >
            <Download size={16} aria-hidden />
          </a>
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div
        className="relative flex flex-1 min-h-0 items-stretch justify-center overflow-auto px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-full max-w-5xl rounded-lg overflow-hidden border bg-[var(--pa-bg)]"
          style={{ borderColor: "var(--pa-divider)" }}
        >
          <AttachmentViewer url={url} mime={mime} filename={name} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
